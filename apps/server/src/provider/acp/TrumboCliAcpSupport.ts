// @effect-diagnostics nodeBuiltinImport:off globalErrorInEffectFailure:off

import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Scope from "effect/Scope";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import * as EffectAcpErrors from "effect-acp/errors";

import * as AcpSessionRuntime from "./AcpSessionRuntime.ts";
import * as TrumboPlatformTokenManager from "../../auth/TrumboPlatformTokenManager.ts";
import { HostProcessPlatform } from "@trumbo-code/shared/hostProcess";

const isWindowsHost = Effect.runSync(HostProcessPlatform) === "win32";

/** Env var the Trumbo CLI's ACP agent reads to skip the OAuth flow. */
const TRUMBO_API_KEY_ENV = "TRUMBO_API_KEY";
const TRUMBO_PROVIDER_ENV = "TRUMBO_PROVIDER";
const TRUMBO_MODEL_ENV = "TRUMBO_MODEL";
const TRUMBO_THINKING_LEVEL_ENV = "TRUMBO_THINKING_LEVEL";
const TRUMBO_CLI_CWD_ENV = "TRUMBO_CLI_CWD";
const TRUMBO_ENABLE_AGENT_TEAMS_ENV = "TRUMBO_ENABLE_AGENT_TEAMS";
const TRUMBO_ENABLE_SPAWN_AGENT_ENV = "TRUMBO_ENABLE_SPAWN_AGENT";

function resolveBunBinary(): string {
  const home = NodeOS.homedir();
  const exe = isWindowsHost ? "bun.exe" : "bun";
  const candidate = NodePath.join(home, ".bun", "bin", exe);
  if (NodeFS.existsSync(candidate)) {
    return candidate;
  }
  return "bun";
}

function resolveTrumboCodeWorkspaceRoot(): string | undefined {
  try {
    let dir = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
    for (let depth = 0; depth < 8; depth += 1) {
      if (NodeFS.existsSync(NodePath.join(dir, "apps", "server", "package.json"))) {
        return dir;
      }
      const parent = NodePath.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function resolveSiblingConsoleWorkspace(): string | undefined {
  const trumboCodeRoot = resolveTrumboCodeWorkspaceRoot();
  if (!trumboCodeRoot) {
    return undefined;
  }
  const sibling = NodePath.resolve(trumboCodeRoot, "../cline-full/projects/console");
  if (NodeFS.existsSync(NodePath.join(sibling, "src", "index.ts"))) {
    return sibling;
  }
  return undefined;
}

export function resolveTrumboCliDevCwd(environment?: NodeJS.ProcessEnv): string | undefined {
  const fromEnv = environment?.[TRUMBO_CLI_CWD_ENV]?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return resolveSiblingConsoleWorkspace();
}

function pathWithBunOnPath(bunBinary: string, environment?: NodeJS.ProcessEnv): string | undefined {
  const bunDir = NodePath.dirname(bunBinary);
  const pathSeparator = isWindowsHost ? ";" : ":";
  const existingPath = environment?.PATH ?? process.env.PATH ?? "";
  if (!existingPath.includes(bunDir)) {
    return `${bunDir}${pathSeparator}${existingPath}`;
  }
  return existingPath;
}

function resolveTrumboCliFeatureFlag(
  value: boolean | undefined,
  defaultEnabled: boolean,
): "0" | "1" {
  const enabled = value ?? defaultEnabled;
  return enabled ? "1" : "0";
}

export function buildTrumboApiEnv(
  environment: NodeJS.ProcessEnv | undefined,
  accessToken: string,
  model: string | undefined,
  extra?: NodeJS.ProcessEnv,
  featureFlags?: {
    readonly enableAgentTeams?: boolean;
    readonly enableSpawnAgent?: boolean;
  },
  thinkingLevel?: string,
): NodeJS.ProcessEnv {
  const normalizedThinkingLevel = thinkingLevel?.trim();
  return {
    ...environment,
    ...extra,
    [TRUMBO_API_KEY_ENV]: accessToken,
    [TRUMBO_PROVIDER_ENV]: "trumbo",
    ...(model ? { [TRUMBO_MODEL_ENV]: model } : {}),
    ...(normalizedThinkingLevel ? { [TRUMBO_THINKING_LEVEL_ENV]: normalizedThinkingLevel } : {}),
    [TRUMBO_ENABLE_AGENT_TEAMS_ENV]: resolveTrumboCliFeatureFlag(
      featureFlags?.enableAgentTeams,
      true,
    ),
    [TRUMBO_ENABLE_SPAWN_AGENT_ENV]: resolveTrumboCliFeatureFlag(
      featureFlags?.enableSpawnAgent,
      true,
    ),
  };
}

export interface TrumboCliAcpRuntimeInput extends Omit<
  AcpSessionRuntime.AcpSessionRuntimeOptions,
  "authMethodId" | "clientCapabilities" | "spawn"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly binaryPath: string | undefined;
  readonly cliCwd: string | undefined;
  readonly model: string | undefined;
  readonly thinkingLevel?: string | undefined;
  readonly enableAgentTeams?: boolean;
  readonly enableSpawnAgent?: boolean;
  readonly environment?: NodeJS.ProcessEnv;
}

export function buildTrumboCliAcpSpawnInput(
  binaryPath: string | undefined,
  cliCwd: string | undefined,
  environment: NodeJS.ProcessEnv | undefined,
  accessToken: string,
  model: string | undefined,
  featureFlags?: {
    readonly enableAgentTeams?: boolean;
    readonly enableSpawnAgent?: boolean;
  },
  thinkingLevel?: string,
): AcpSessionRuntime.AcpSpawnInput {
  const configuredBinary = binaryPath?.trim();
  if (configuredBinary) {
    return {
      command: configuredBinary,
      args: ["--acp"],
      env: buildTrumboApiEnv(
        environment,
        accessToken,
        model,
        undefined,
        featureFlags,
        thinkingLevel,
      ),
    };
  }

  const devCwd = cliCwd?.trim() || resolveTrumboCliDevCwd(environment);
  if (devCwd) {
    const bunBinary = resolveBunBinary();
    return {
      command: bunBinary,
      args: ["run", "src/index.ts", "--acp"],
      cwd: devCwd,
      env: buildTrumboApiEnv(
        environment,
        accessToken,
        model,
        {
          PATH: pathWithBunOnPath(bunBinary, environment),
        },
        featureFlags,
        thinkingLevel,
      ),
    };
  }

  return {
    command: "trumbo",
    args: ["--acp"],
    env: buildTrumboApiEnv(environment, accessToken, model, undefined, featureFlags, thinkingLevel),
  };
}

export const makeTrumboCliAcpRuntime = (
  input: TrumboCliAcpRuntimeInput,
): Effect.Effect<
  AcpSessionRuntime.AcpSessionRuntime["Service"],
  EffectAcpErrors.AcpError | Error,
  Crypto.Crypto | Scope.Scope | TrumboPlatformTokenManager.TrumboPlatformTokenManager
> =>
  Effect.gen(function* () {
    const tokenManager = yield* TrumboPlatformTokenManager.TrumboPlatformTokenManager;
    const accessToken = yield* tokenManager.getAccessToken;
    if (Option.isNone(accessToken)) {
      // @effect-diagnostics-next-line globalErrorInEffectFailure:off - user-facing sign-in prompt error.
      return yield* Effect.fail(
        new Error("Sign in to Trumbo on this device to use the Trumbo CLI provider."),
      );
    }

    const spawn = buildTrumboCliAcpSpawnInput(
      input.binaryPath,
      input.cliCwd,
      input.environment,
      accessToken.value,
      input.model,
      {
        ...(input.enableAgentTeams !== undefined
          ? { enableAgentTeams: input.enableAgentTeams }
          : {}),
        ...(input.enableSpawnAgent !== undefined
          ? { enableSpawnAgent: input.enableSpawnAgent }
          : {}),
      },
      input.thinkingLevel,
    );

    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...input,
        spawn,
        authMethodId: "trumbo",
        clientInfo: {
          name: "trumbo-code",
          version: "0.0.28",
        },
      }).pipe(
        Layer.provide(
          Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, input.childProcessSpawner),
        ),
      ),
    );
    return yield* Effect.service(AcpSessionRuntime.AcpSessionRuntime).pipe(
      Effect.provide(acpContext),
    );
  });
