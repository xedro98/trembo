import { useCallback } from "react";

import {
  resolveTrumboModelAccessMessage,
  TRUMBO_PLATFORM_BILLING_URL,
  TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE,
} from "@trumbo-code/shared/trumboSubscription";

import { isNativeTrumboDesktop } from "../../lib/nativeTrumboDesktop";
import { useTrumboAuthState, isTrumboSignedIn } from "./useTrumboAuthState";
import { useTrumboConnectAuthPrompt } from "./useTrumboConnectAuthPrompt";

interface DesktopBridge {
  openExternal?: (url: string) => Promise<void>;
}

function getDesktopBridge(): DesktopBridge | undefined {
  return (window as unknown as { desktopBridge?: DesktopBridge }).desktopBridge;
}

async function openUrlInBrowser(url: string): Promise<void> {
  const bridge = getDesktopBridge();
  if (bridge?.openExternal) {
    await bridge.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function useTrumboModelAccess() {
  const authState = useTrumboAuthState();
  const { openAuthPrompt, authPrompt } = useTrumboConnectAuthPrompt();
  const accessMessage = resolveTrumboModelAccessMessage(authState);
  const needsSignIn = !isTrumboSignedIn(authState);
  const needsSubscribe =
    authState?.status === "signed-in" && accessMessage === TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE;

  const openSubscribePrompt = useCallback(() => {
    void openUrlInBrowser(TRUMBO_PLATFORM_BILLING_URL);
  }, []);

  const resolveModelDisabledReason = useCallback(
    (isTrumboProvider: boolean): string | null => {
      if (!isNativeTrumboDesktop() || !isTrumboProvider) {
        return null;
      }
      return accessMessage;
    },
    [accessMessage],
  );

  const promptForModelAccess = useCallback(() => {
    if (needsSignIn) {
      void openAuthPrompt();
      return;
    }
    if (needsSubscribe) {
      openSubscribePrompt();
    }
  }, [needsSignIn, needsSubscribe, openAuthPrompt, openSubscribePrompt]);

  return {
    authState,
    accessMessage,
    needsSignIn,
    needsSubscribe,
    authPrompt,
    openAuthPrompt,
    openSubscribePrompt,
    promptForModelAccess,
    resolveModelDisabledReason,
  };
}
