import * as NodeModule from "node:module";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";

import * as Electron from "electron";

import type { TrumboAuthState, TrumboDeviceCodeRequest } from "@trumbo-code/contracts";

import * as ElectronApp from "../electron/ElectronApp.ts";
import * as ElectronWindow from "../electron/ElectronWindow.ts";
import * as DesktopEnvironment from "./DesktopEnvironment.ts";
import * as DesktopTrumboSubscription from "./DesktopTrumboSubscription.ts";
import * as IpcChannels from "../ipc/channels.ts";
import {
  clearTrumboPlatformToken,
  resolveDesktopSecretsDir,
  syncTrumboPlatformToken,
  type TrumboPlatformTokenSession,
} from "./DesktopTrumboPlatformTokenBridge.ts";

declare const __TRUMBO_CODE_BUILD_PLATFORM_URL__: string | undefined;
declare const __TRUMBO_CODE_BUILD_OAUTH_CLIENT_ID__: string | undefined;

const DEFAULT_PLATFORM_URL = "https://platform.trumbo.dev";
const DEFAULT_OAUTH_CLIENT_ID = "trumbo-code-desktop";
const OAUTH_DEVICE_PATH = "/oauth/device";
const OAUTH_TOKEN_PATH = "/oauth/token";
const PROFILE_PATH = "/api/me";
const TOKEN_STORE_FILE = "trumbo-auth.json";
const DEVICE_CODE_POLL_INTERVAL_SAFETY_MS = 1_000;
const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
const PLAN_REFRESH_INTERVAL_MS = 30_000;

export function resolveTrumboPlatformUrl(): string {
  const fromEnv = process.env.TRUMBO_CODE_PLATFORM_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/u, "");
  const fromBuild =
    typeof __TRUMBO_CODE_BUILD_PLATFORM_URL__ === "string"
      ? __TRUMBO_CODE_BUILD_PLATFORM_URL__.trim()
      : "";
  if (fromBuild) return fromBuild.replace(/\/+$/u, "");
  return DEFAULT_PLATFORM_URL;
}

export function resolveTrumboOAuthClientId(): string {
  const fromEnv = process.env.TRUMBO_CODE_OAUTH_CLIENT_ID?.trim();
  if (fromEnv) return fromEnv;
  const fromBuild =
    typeof __TRUMBO_CODE_BUILD_OAUTH_CLIENT_ID__ === "string"
      ? __TRUMBO_CODE_BUILD_OAUTH_CLIENT_ID__.trim()
      : "";
  if (fromBuild) return fromBuild;
  return DEFAULT_OAUTH_CLIENT_ID;
}

export const desktopTrumboPlatformHostname: string | undefined = (() => {
  try {
    return new URL(resolveTrumboPlatformUrl()).hostname;
  } catch {
    return undefined;
  }
})();

export class DesktopTrumboAuthBridgeInitializationError extends Schema.TaggedErrorClass<DesktopTrumboAuthBridgeInitializationError>()(
  "DesktopTrumboAuthBridgeInitializationError",
  {
    stateDir: Schema.String,
    isDevelopment: Schema.Boolean,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to initialize the Trumbo auth bridge for state directory "${this.stateDir}" (development: ${this.isDevelopment}).`;
  }
}

const TrumboAuthUserSchema = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  name: Schema.optional(Schema.String),
  avatarUrl: Schema.optional(Schema.String),
});

const TrumboPlanRateLimitWindowSchema = Schema.Struct({
  used: Schema.Number,
  limit: Schema.Number,
  resetsAtSec: Schema.Number,
});

const TrumboPlanUsageSchema = Schema.Struct({
  fiveHour: Schema.optional(TrumboPlanRateLimitWindowSchema),
  daily: Schema.optional(TrumboPlanRateLimitWindowSchema),
  weekly: Schema.optional(TrumboPlanRateLimitWindowSchema),
});

const TrumboSubscriptionSchema = Schema.Struct({
  tier: Schema.Literals(["free", "pro", "max", "ultra"]),
  status: Schema.Literals(["active", "trialing", "past_due", "canceled", "none"]),
  periodEnd: Schema.optional(Schema.String),
  displayName: Schema.optional(Schema.String),
  usage: Schema.optional(TrumboPlanUsageSchema),
});

interface StoredTrumboAuthSession {
  readonly accessToken: string;
  readonly refreshToken: string | undefined;
  readonly expiresAtEpochMs: number;
  readonly user: unknown;
  readonly subscription: unknown;
}

interface DeviceCodeResponse {
  readonly device_code: string;
  readonly user_code: string;
  readonly verification_uri: string;
  readonly verification_uri_complete?: string;
  readonly expires_in: number;
  readonly interval: number;
}

interface TokenResponse {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly token_type?: string;
}

interface DeviceCodePollError {
  readonly error: string;
  readonly error_description?: string;
  readonly interval?: number;
}

interface TrumboAuthRuntimeState {
  readonly status: "signed-out" | "signing-in" | "signed-in" | "error";
  readonly user?: unknown;
  readonly subscription?: unknown;
  readonly errorMessage?: string;
  readonly pendingDeviceCode?: DeviceCodeResponse;
  readonly accessToken?: string;
}

const EMPTY_STATE: TrumboAuthRuntimeState = { status: "signed-out" };

export function toTrumboDeviceCodeRequest(response: DeviceCodeResponse): TrumboDeviceCodeRequest {
  return {
    deviceCode: response.device_code,
    userCode: response.user_code,
    verificationUri: response.verification_uri,
    ...(response.verification_uri_complete !== undefined
      ? { verificationUriComplete: response.verification_uri_complete }
      : {}),
    expiresIn: response.expires_in,
    interval: response.interval,
  };
}

export function toPublicTrumboAuthState(state: TrumboAuthRuntimeState): TrumboAuthState {
  return {
    status: state.status,
    ...(state.user !== undefined ? { user: state.user as TrumboAuthState["user"] } : {}),
    ...(state.subscription !== undefined
      ? { subscription: state.subscription as TrumboAuthState["subscription"] }
      : {}),
    ...(state.errorMessage !== undefined ? { errorMessage: state.errorMessage } : {}),
    ...(state.accessToken !== undefined ? { accessToken: state.accessToken } : {}),
    ...(state.pendingDeviceCode !== undefined
      ? { deviceCode: toTrumboDeviceCodeRequest(state.pendingDeviceCode) }
      : {}),
  } as TrumboAuthState;
}

export class DesktopTrumboAuth extends Context.Service<
  DesktopTrumboAuth,
  {
    readonly configure: Effect.Effect<
      void,
      never,
      ElectronApp.ElectronApp | ElectronWindow.ElectronWindow | Scope.Scope
    >;
  }
>()("@trumbo-code/desktop/app/DesktopTrumboAuth") {}

interface TrumboAuthStore {
  readonly load: () => StoredTrumboAuthSession | undefined;
  readonly save: (session: StoredTrumboAuthSession | undefined) => void;
  readonly clear: () => void;
}

function createTrumboAuthStore(stateDir: string): TrumboAuthStore {
  // electron-store v8 ships as CommonJS. Resolve it lazily via createRequire so
  // the module loads in both dev and packaged Electron main (globalThis.require
  // is not guaranteed once the bundle is inside app.asar).
  const require = NodeModule.createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Store = require("electron-store") as {
    new (opts: unknown): {
      get: (key: string) => unknown;
      set: (key: string, value: unknown) => void;
      delete: (key: string) => void;
      path: string;
    };
  };
  const store = new Store({
    cwd: stateDir,
    name: TOKEN_STORE_FILE.replace(/\.json$/u, ""),
    accessPropertiesByDotNotation: false,
  });

  const encrypt = (value: string): string => {
    try {
      if (Electron.safeStorage.isEncryptionAvailable()) {
        return Electron.safeStorage.encryptString(value).toString("base64");
      }
    } catch {
      // fall through to plaintext
    }
    return value;
  };

  const decrypt = (value: string): string => {
    try {
      if (Electron.safeStorage.isEncryptionAvailable()) {
        return Electron.safeStorage.decryptString(Buffer.from(value, "base64"));
      }
    } catch {
      return value;
    }
    return value;
  };

  return {
    load: () => {
      const raw = store.get("session") as
        | (Omit<StoredTrumboAuthSession, "accessToken" | "refreshToken"> & {
            readonly accessToken: string;
            readonly refreshToken?: string;
          })
        | undefined;
      if (!raw) return undefined;
      return {
        ...raw,
        accessToken: decrypt(raw.accessToken),
        refreshToken: raw.refreshToken ? decrypt(raw.refreshToken) : undefined,
      };
    },
    save: (session) => {
      if (!session) {
        store.delete("session");
        return;
      }
      store.set("session", {
        ...session,
        accessToken: encrypt(session.accessToken),
        refreshToken: session.refreshToken ? encrypt(session.refreshToken) : undefined,
      });
    },
    clear: () => store.delete("session"),
  };
}

async function postJson(url: string, body: Record<string, unknown>, accessToken?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  // @effect-diagnostics-next-line globalFetch:off - Electron renderer uses global fetch for platform OAuth.
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return response;
}

async function getJson(url: string, accessToken: string) {
  // @effect-diagnostics-next-line globalFetch:off - Electron renderer uses global fetch for platform OAuth.
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response;
}

function decodeJson(response: Response): Promise<unknown> {
  if (response.status === 204) return Promise.resolve(undefined);
  return response
    .json()
    .catch(() => undefined)
    .then((value) => value as unknown);
}

function sleep(ms: number): Promise<void> {
  // @effect-diagnostics-next-line globalTimers:off - non-Effect poll loop uses setTimeout.
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const make = Effect.gen(function* () {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  let runtimeState: TrumboAuthRuntimeState = EMPTY_STATE;
  let pollCancelled = false;
  let store: TrumboAuthStore | undefined;

  const platformUrl = resolveTrumboPlatformUrl();
  const clientId = resolveTrumboOAuthClientId();

  // Must run synchronously from async poll callbacks and IPC handlers — Effect
  // Ref unsafe helpers are not available outside the runtime fiber.
  const publishState = (next: TrumboAuthRuntimeState) => {
    runtimeState = next;
    const secretsDir = resolveDesktopSecretsDir(environment.stateDir);
    if (next.status === "signed-in" && next.accessToken) {
      const stored = store?.load();
      syncTrumboPlatformToken(
        secretsDir,
        (stored ?? {
          accessToken: next.accessToken,
          // @effect-diagnostics-next-line globalDate:off - non-Effect token expiry estimate.
          expiresAtEpochMs: Date.now() + 3_600_000,
        }) as TrumboPlatformTokenSession,
      );
    } else {
      clearTrumboPlatformToken(secretsDir);
    }
    const publicState = toPublicTrumboAuthState(next);
    for (const window of Electron.BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IpcChannels.TRUMBO_AUTH_STATE_CHANGE_CHANNEL, publicState);
      }
    }
  };

  const hydrateFromStore = Effect.sync(() => {
    if (!store) return;
    const stored = store.load();
    if (!stored) {
      publishState(EMPTY_STATE);
      return;
    }
    publishState({
      status: "signed-in",
      user: stored.user,
      subscription: stored.subscription,
      accessToken: stored.accessToken,
    });
  });

  const fetchProfileAndSubscription = async (
    accessToken: string,
  ): Promise<{ user: unknown; subscription: unknown }> => {
    const [profileRes, subRes] = await Promise.all([
      getJson(`${platformUrl}${PROFILE_PATH}`, accessToken),
      getJson(`${platformUrl}${DesktopTrumboSubscription.SUBSCRIPTION_PATH}`, accessToken),
    ]);
    const user = profileRes.ok ? await decodeJson(profileRes) : undefined;
    const subscription = subRes.ok ? await decodeJson(subRes) : undefined;
    return { user, subscription };
  };

  const persistSession = (
    token: TokenResponse,
    extras: { user: unknown; subscription: unknown },
  ) => {
    if (!store) return;
    // @effect-diagnostics-next-line globalDate:off - non-Effect token persistence.
    const issuedAt = Date.now();
    store.save({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAtEpochMs: issuedAt + token.expires_in * 1_000,
      user: extras.user,
      subscription: extras.subscription,
    });
  };

  const pollForToken = async (deviceCode: string, intervalSeconds: number, expiresAt: number) => {
    pollCancelled = false;
    let pollIntervalSeconds = Math.max(1, intervalSeconds);

    // @effect-diagnostics-next-line globalDate:off - non-Effect poll loop.
    while (Date.now() < expiresAt) {
      if (pollCancelled) return;

      try {
        const response = await postJson(`${platformUrl}${OAUTH_TOKEN_PATH}`, {
          grant_type: DEVICE_CODE_GRANT_TYPE,
          device_code: deviceCode,
          client_id: clientId,
        });

        if (response.ok) {
          const token = (await decodeJson(response)) as TokenResponse;
          if (!token?.access_token) {
            publishState({
              status: "error",
              errorMessage: "Invalid token response from Trumbo platform.",
            });
            return;
          }
          try {
            const profile = await fetchProfileAndSubscription(token.access_token);
            persistSession(token, profile);
            publishState({
              status: "signed-in",
              user: profile.user,
              subscription: profile.subscription,
              accessToken: token.access_token,
            });
          } catch {
            persistSession(token, { user: undefined, subscription: undefined });
            publishState({ status: "signed-in", accessToken: token.access_token });
          }
          return;
        }

        const errorBody = (await decodeJson(response)) as DeviceCodePollError | undefined;
        if (!errorBody) {
          await sleep(pollIntervalSeconds * 1_000 + DEVICE_CODE_POLL_INTERVAL_SAFETY_MS);
          continue;
        }
        if (errorBody.error === "authorization_pending") {
          await sleep(pollIntervalSeconds * 1_000 + DEVICE_CODE_POLL_INTERVAL_SAFETY_MS);
          continue;
        }
        if (errorBody.error === "slow_down") {
          pollIntervalSeconds = Math.max(
            pollIntervalSeconds + 5,
            errorBody.interval ?? pollIntervalSeconds + 5,
          );
          await sleep(pollIntervalSeconds * 1_000 + DEVICE_CODE_POLL_INTERVAL_SAFETY_MS);
          continue;
        }
        publishState({
          status: "error",
          errorMessage:
            errorBody.error_description ?? errorBody.error ?? "Sign-in failed. Please try again.",
        });
        return;
      } catch {
        await sleep(pollIntervalSeconds * 1_000 + DEVICE_CODE_POLL_INTERVAL_SAFETY_MS);
      }
    }
    publishState({ status: "signed-out", errorMessage: "Sign-in timed out. Please try again." });
  };

  const startSignIn = Effect.tryPromise(() => {
    if (!store) store = createTrumboAuthStore(environment.stateDir);
    publishState({ status: "signing-in" });

    return postJson(`${platformUrl}${OAUTH_DEVICE_PATH}`, {
      client_id: clientId,
      scope: "openid profile email billing:read",
    }).then(async (response) => {
      if (!response.ok) {
        const errorBody = (await decodeJson(response)) as DeviceCodePollError | undefined;
        publishState({
          status: "error",
          errorMessage:
            errorBody?.error_description ?? errorBody?.error ?? "Could not start sign-in.",
        });
        return undefined;
      }

      const deviceCode = (await decodeJson(response)) as DeviceCodeResponse;
      publishState({ status: "signing-in", pendingDeviceCode: deviceCode });

      // @effect-diagnostics-next-line globalDate:off - device-code expiry estimate inside Electron OAuth flow.
      const expiresAt = Date.now() + deviceCode.expires_in * 1_000;
      void pollForToken(deviceCode.device_code, deviceCode.interval, expiresAt);

      return toTrumboDeviceCodeRequest(deviceCode);
    });
  }).pipe(
    Effect.catch((cause) =>
      Effect.sync(() => {
        publishState({
          status: "error",
          errorMessage: cause instanceof Error ? cause.message : "Sign-in failed.",
        });
        return undefined;
      }),
    ),
  );

  const cancelSignIn = Effect.sync(() => {
    pollCancelled = true;
    publishState({ status: "signed-out" });
  });

  const signOut = Effect.sync(() => {
    if (store) {
      const stored = store.load();
      if (stored?.refreshToken) {
        void postJson(`${platformUrl}${OAUTH_TOKEN_PATH}`, {
          grant_type: "refresh_token",
          refresh_token: stored.refreshToken,
          client_id: clientId,
          action: "revoke",
        }).catch(() => undefined);
      }
      store.clear();
    }
    pollCancelled = true;
    publishState(EMPTY_STATE);
  });

  const refresh = Effect.gen(function* () {
    if (!store) store = createTrumboAuthStore(environment.stateDir);
    const stored = store.load();
    if (!stored) {
      publishState(EMPTY_STATE);
      return;
    }
    try {
      const profile = yield* Effect.tryPromise(() =>
        fetchProfileAndSubscription(stored.accessToken),
      );
      store.save({
        ...stored,
        user: profile.user,
        subscription: profile.subscription,
      });
      publishState({
        status: "signed-in",
        user: profile.user,
        subscription: profile.subscription,
        accessToken: stored.accessToken,
      });
    } catch {
      publishState({
        status: "signed-in",
        user: stored.user,
        subscription: stored.subscription,
        accessToken: stored.accessToken,
      });
    }
  });

  const registerIpcHandlers = Effect.sync(() => {
    const ipcMain = Electron.ipcMain;
    ipcMain.handle(IpcChannels.TRUMBO_AUTH_GET_STATE_CHANNEL, () =>
      toPublicTrumboAuthState(runtimeState),
    );
    ipcMain.handle(IpcChannels.TRUMBO_AUTH_START_SIGN_IN_CHANNEL, async () => {
      const result = await Effect.runPromise(startSignIn);
      return result;
    });
    ipcMain.handle(IpcChannels.TRUMBO_AUTH_CANCEL_SIGN_IN_CHANNEL, async () => {
      await Effect.runPromise(cancelSignIn);
    });
    ipcMain.handle(IpcChannels.TRUMBO_AUTH_SIGN_OUT_CHANNEL, async () => {
      await Effect.runPromise(signOut);
    });
    ipcMain.handle(IpcChannels.TRUMBO_AUTH_REFRESH_CHANNEL, async () => {
      await Effect.runPromise(refresh);
      return toPublicTrumboAuthState(runtimeState);
    });
  });

  return DesktopTrumboAuth.of({
    configure: Effect.gen(function* () {
      const electronApp = yield* ElectronApp.ElectronApp;
      const electronWindow = yield* ElectronWindow.ElectronWindow;
      const context = yield* Effect.context<ElectronWindow.ElectronWindow>();
      const runPromise = Effect.runPromiseWith(context);

      if (!(yield* electronApp.requestSingleInstanceLock)) {
        yield* electronApp.quit;
        return yield* Effect.interrupt;
      }

      yield* electronApp.on("second-instance", () => {
        void runPromise(
          Effect.gen(function* () {
            const mainWindow = yield* electronWindow.currentMainOrFirst;
            if (Option.isSome(mainWindow)) {
              yield* electronWindow.reveal(mainWindow.value);
            }
          }),
        );
      });

      yield* Effect.acquireRelease(
        Effect.try({
          try: () => {
            store = createTrumboAuthStore(environment.stateDir);
          },
          catch: (cause) =>
            new DesktopTrumboAuthBridgeInitializationError({
              stateDir: environment.stateDir,
              isDevelopment: environment.isDevelopment,
              cause,
            }),
        }),
        () => Effect.sync(() => undefined),
      );

      yield* registerIpcHandlers;
      yield* hydrateFromStore;

      const refreshSignedInSubscription = () => {
        if (!store) return;
        const stored = store.load();
        if (!stored?.accessToken) return;
        void fetchProfileAndSubscription(stored.accessToken)
          .then((profile) => {
            store?.save({
              ...stored,
              user: profile.user,
              subscription: profile.subscription,
            });
            publishState({
              status: "signed-in",
              user: profile.user,
              subscription: profile.subscription,
              accessToken: stored.accessToken,
            });
          })
          .catch(() => undefined);
      };

      // @effect-diagnostics-next-line globalTimersInEffect:off - Electron main-process subscription refresh timer.
      const planRefreshTimer = setInterval(refreshSignedInSubscription, PLAN_REFRESH_INTERVAL_MS);
      if (typeof planRefreshTimer === "object" && "unref" in planRefreshTimer) {
        planRefreshTimer.unref();
      }
    }).pipe(
      Effect.withSpan("desktop.trumboAuth.configure"),
      Effect.asVoid,
      Effect.catch(() => Effect.void),
    ),
  });
});

export const layer = Layer.effect(DesktopTrumboAuth, make);

export const decodeTrumboAuthUser = Schema.decodeUnknownOption(TrumboAuthUserSchema);
export const decodeTrumboSubscription = Schema.decodeUnknownOption(TrumboSubscriptionSchema);
