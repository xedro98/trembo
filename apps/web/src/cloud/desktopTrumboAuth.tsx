import type { DesktopTrumboAuthBridge, TrumboAuthState } from "@trumbo-code/contracts";
import { reportAtomCommandResult, settlePromise } from "@trumbo-code/client-runtime/state/runtime";
import { useEffect, useRef, type ReactNode } from "react";

import { environmentCatalog } from "../connection/catalog";
import { useAtomCommand } from "../state/use-atom-command";
import { deactivateManagedRelayAuthentication } from "./managedAuth";

/**
 * Desktop Trumbo account auth provider. The packaged native desktop app uses
 * platform.trumbo.dev (RFC 8628 device-code flow) for sign-in, billing, and
 * mobile-client listing. It does not activate a Trumbo Connect relay session.
 */
function getDesktopTrumboAuth(): DesktopTrumboAuthBridge | undefined {
  return (window as unknown as { desktopBridge?: { trumboAuth?: DesktopTrumboAuthBridge } })
    .desktopBridge?.trumboAuth;
}

export function DesktopTrumboAuthProvider({ children }: { readonly children: ReactNode }) {
  const bridge = getDesktopTrumboAuth();
  const removeRelayEnvironments = useAtomCommand(environmentCatalog.removeRelayEnvironments, {
    reportFailure: false,
    reportDefect: false,
  });
  const observedAccountRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!bridge) return;

    let cancelled = false;

    const applyState = (state: TrumboAuthState) => {
      if (cancelled) return;
      const accountId =
        state.status === "signed-in" && state.accessToken && state.user?.id ? state.user.id : null;
      const previousAccount = observedAccountRef.current;
      observedAccountRef.current = accountId;

      if (accountId === null) {
        deactivateManagedRelayAuthentication();
        if (previousAccount !== null && previousAccount !== undefined) {
          void (async () => {
            const result = await settlePromise(() => removeRelayEnvironments());
            reportAtomCommandResult(result, { label: "desktop cloud account cleanup" });
          })();
        }
      }
    };

    void bridge.getState().then(applyState);
    const unsubscribe = bridge.onStateChange(applyState);

    return () => {
      cancelled = true;
      unsubscribe();
      deactivateManagedRelayAuthentication();
    };
  }, [bridge, removeRelayEnvironments]);

  return children;
}
