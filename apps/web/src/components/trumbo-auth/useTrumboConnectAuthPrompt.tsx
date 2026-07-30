import { useCallback, useEffect, useState } from "react";

import type { TrumboAuthState, TrumboDeviceCodeRequest } from "@trumbo-code/contracts";

import { hasCloudPublicConfig } from "../../cloud/publicConfig";
import { isNativeTrumboDesktop } from "../../lib/nativeTrumboDesktop";
import { TrumboWordmark } from "../TrumboWordmark";
import { getDesktopTrumboAuthBridge } from "./useTrumboAuthState";

const PLATFORM_SIGN_IN_URL = "https://platform.trumbo.dev/sign-in";

interface DesktopTrumboAuthBridge {
  getState: () => Promise<TrumboAuthState>;
  startSignIn: () => Promise<TrumboDeviceCodeRequest | undefined>;
  cancelSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<TrumboAuthState>;
  onStateChange: (listener: (state: TrumboAuthState) => void) => () => void;
}

interface DesktopBridge {
  openExternal?: (url: string) => Promise<void>;
}

function getDesktopBridge(): DesktopBridge | undefined {
  return (window as unknown as { desktopBridge?: DesktopBridge }).desktopBridge;
}

async function waitForDesktopTrumboAuth(
  timeoutMs = 3_000,
): Promise<DesktopTrumboAuthBridge | undefined> {
  const existing = getDesktopTrumboAuthBridge() as DesktopTrumboAuthBridge | undefined;
  if (existing) {
    return existing;
  }
  if (!isNativeTrumboDesktop()) {
    return undefined;
  }

  return await new Promise((resolve) => {
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const desktop = getDesktopTrumboAuthBridge() as DesktopTrumboAuthBridge | undefined;
      if (desktop) {
        window.clearInterval(intervalId);
        resolve(desktop);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(intervalId);
        resolve(undefined);
      }
    }, 50);
  });
}

async function openVerificationUrl(url: string): Promise<void> {
  const bridge = getDesktopBridge();
  if (bridge?.openExternal) {
    await bridge.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function syncDeviceCodeFromState(state: TrumboAuthState): TrumboDeviceCodeRequest | undefined {
  if (state.status === "signing-in" && state.deviceCode) {
    return state.deviceCode;
  }
  return undefined;
}

/**
 * Trumbo account sign-in prompt. In the desktop Electron shell it drives the
 * RFC 8628 device-code flow exposed on `window.desktopBridge.trumboAuth`; in
 * the hosted web build it redirects to the platform sign-in page so the
 * browser can establish a same-origin session cookie on platform.trumbo.dev.
 */
export function useTrumboConnectAuthPrompt() {
  const [deviceCode, setDeviceCode] = useState<TrumboDeviceCodeRequest | undefined>(undefined);
  const [state, setState] = useState<TrumboAuthState | undefined>(undefined);
  const [bridgeReady, setBridgeReady] = useState(() => Boolean(getDesktopTrumboAuthBridge()));

  useEffect(() => {
    if (bridgeReady) {
      return;
    }
    if (!isNativeTrumboDesktop()) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      if (cancelled || !getDesktopTrumboAuthBridge()) {
        return;
      }
      window.clearInterval(intervalId);
      setBridgeReady(true);
    }, 50);

    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
    }, 3_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [bridgeReady]);

  useEffect(() => {
    const desktop = getDesktopTrumboAuthBridge() as DesktopTrumboAuthBridge | undefined;
    if (!desktop) {
      return;
    }

    const unsubscribe = desktop.onStateChange((next) => {
      setState(next);
      if (next.status === "signed-in" || next.status === "error" || next.status === "signed-out") {
        setDeviceCode(undefined);
        return;
      }
      if (next.status === "signing-in") {
        setDeviceCode((current) => syncDeviceCodeFromState(next) ?? current);
      }
    });
    void desktop.getState().then((next) => {
      setState(next);
      setDeviceCode(syncDeviceCodeFromState(next));
    });
    return unsubscribe;
  }, [bridgeReady]);

  const openAuthPrompt = useCallback(async () => {
    const desktop = (await waitForDesktopTrumboAuth()) ?? null;
    if (desktop) {
      const request = await desktop.startSignIn();
      if (request) {
        setDeviceCode(request);
        const verificationUrl = request.verificationUriComplete ?? request.verificationUri;
        if (verificationUrl) {
          void openVerificationUrl(verificationUrl).catch(() => undefined);
        }
      }
      return;
    }
    if (hasCloudPublicConfig()) {
      window.location.href = PLATFORM_SIGN_IN_URL;
    }
  }, []);

  const cancelSignIn = useCallback(async () => {
    const desktop = getDesktopTrumboAuthBridge() as DesktopTrumboAuthBridge | undefined;
    if (!desktop) {
      return;
    }
    await desktop.cancelSignIn();
    setDeviceCode(undefined);
  }, []);

  const authPrompt =
    deviceCode && state?.status !== "signed-in" ? (
      <TrumboDeviceCodePrompt deviceCode={deviceCode} onCancel={cancelSignIn} />
    ) : state?.status === "error" && state.errorMessage ? (
      <TrumboAuthErrorPrompt message={state.errorMessage} onDismiss={cancelSignIn} />
    ) : null;

  return { authPrompt, openAuthPrompt, authState: state };
}

function TrumboDeviceCodePrompt({
  deviceCode,
  onCancel,
}: {
  deviceCode: TrumboDeviceCodeRequest;
  onCancel: () => void;
}) {
  const openVerification = () => {
    const url = deviceCode.verificationUriComplete ?? deviceCode.verificationUri;
    void openVerificationUrl(url).catch(() => undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-3 flex items-center gap-2">
          <TrumboWordmark className="size-5 shrink-0 text-[#2BBF77]" />
          <span className="text-sm font-medium tracking-tight text-foreground">Trumbo</span>
        </div>
        <h2 className="text-base font-semibold text-card-foreground">Sign in to Trumbo</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your browser should open to the verification page. Enter this code to link this device to
          your Trumbo account.
        </p>
        <div className="mt-4 select-all rounded-md border border-border bg-muted px-4 py-3 text-center font-mono text-2xl tracking-widest text-foreground">
          {deviceCode.userCode || "…"}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={openVerification}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open verification page
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function TrumboAuthErrorPrompt({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-3 flex items-center gap-2">
          <TrumboWordmark className="size-5 shrink-0 text-[#2BBF77]" />
          <span className="text-sm font-medium tracking-tight text-foreground">Trumbo</span>
        </div>
        <h2 className="text-base font-semibold text-card-foreground">Sign-in failed</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
