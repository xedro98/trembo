import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@trumbo-code/client-runtime/state/runtime";
import { useEffect, useRef } from "react";

import { isNativeTrumboDesktop } from "../../lib/nativeTrumboDesktop";
import { safeErrorLogAttributes } from "@trumbo-code/client-runtime/errors";
import { usePrimaryEnvironment } from "../../state/environments";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { useTrumboAuthState } from "./useTrumboAuthState";

/** Re-probe provider auth after the desktop OAuth token is synced to the local server. */
export function TrumboAuthProviderRefresh() {
  const auth = useTrumboAuthState();
  const primaryEnvironment = usePrimaryEnvironment();
  const refreshServerProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const lastRefreshedTokenRef = useRef<string | null>(null);

  const environmentConnected = primaryEnvironment?.connection.phase === "connected";

  useEffect(() => {
    if (!isNativeTrumboDesktop()) return;
    if (auth?.status !== "signed-in" || !auth.accessToken) return;
    if (!primaryEnvironment || !environmentConnected) return;
    const refreshKey = `${auth.accessToken}:${auth.subscription?.tier ?? "none"}:${auth.subscription?.status ?? "none"}`;
    if (lastRefreshedTokenRef.current === refreshKey) return;

    lastRefreshedTokenRef.current = refreshKey;
    void (async () => {
      const result = await refreshServerProviders({
        environmentId: primaryEnvironment.environmentId,
        input: {},
      });
      if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
        console.warn("Failed to refresh providers after Trumbo sign-in", {
          operation: "trumbo-auth-provider-refresh",
          environmentId: primaryEnvironment.environmentId,
          ...safeErrorLogAttributes(squashAtomCommandFailure(result)),
        });
      }
    })();
  }, [
    auth?.accessToken,
    auth?.status,
    auth?.subscription?.status,
    auth?.subscription?.tier,
    environmentConnected,
    primaryEnvironment,
    refreshServerProviders,
  ]);

  return null;
}
