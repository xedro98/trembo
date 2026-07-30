import type { TrumboAuthState } from "@trumbo-code/contracts";
import { useEffect, useState } from "react";

import { isNativeTrumboDesktop } from "../../lib/nativeTrumboDesktop";

const SIGNED_OUT_STATE: TrumboAuthState = { status: "signed-out" };

interface DesktopTrumboAuthBridge {
  getState: () => Promise<TrumboAuthState>;
  onStateChange: (listener: (state: TrumboAuthState) => void) => () => void;
}

export function getDesktopTrumboAuthBridge(): DesktopTrumboAuthBridge | undefined {
  return (window as unknown as { desktopBridge?: { trumboAuth?: DesktopTrumboAuthBridge } })
    .desktopBridge?.trumboAuth;
}

export function isTrumboSignedIn(
  authState: TrumboAuthState | undefined,
): authState is TrumboAuthState & { status: "signed-in" } {
  return authState?.status === "signed-in";
}

/**
 * Desktop Trumbo account state from `window.desktopBridge.trumboAuth`.
 * On native desktop, defaults to signed-out until the bridge responds so UI
 * never sits in a blank "auth unknown" state.
 */
export function useTrumboAuthState(): TrumboAuthState | undefined {
  const nativeDesktop = isNativeTrumboDesktop();
  const [state, setState] = useState<TrumboAuthState | undefined>(() =>
    nativeDesktop ? undefined : undefined,
  );

  useEffect(() => {
    if (!nativeDesktop) {
      setState(undefined);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let intervalId: number | undefined;
    let timeoutId: number | undefined;

    const attach = (desktop: DesktopTrumboAuthBridge) => {
      unsubscribe = desktop.onStateChange((next) => {
        if (!cancelled) {
          setState(next);
        }
      });
      void desktop.getState().then((next) => {
        if (!cancelled) {
          setState(next);
        }
      });
    };

    const existing = getDesktopTrumboAuthBridge();
    if (existing) {
      attach(existing);
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    }

    intervalId = window.setInterval(() => {
      const desktop = getDesktopTrumboAuthBridge();
      if (!desktop || cancelled) {
        return;
      }
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      attach(desktop);
    }, 50);

    timeoutId = window.setTimeout(() => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
      if (!cancelled && !getDesktopTrumboAuthBridge()) {
        setState(SIGNED_OUT_STATE);
      }
    }, 3_000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      unsubscribe?.();
    };
  }, [nativeDesktop]);

  if (!nativeDesktop) {
    return undefined;
  }

  return state ?? SIGNED_OUT_STATE;
}
