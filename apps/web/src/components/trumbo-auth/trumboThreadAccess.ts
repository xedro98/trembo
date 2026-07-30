import type { TrumboAuthState } from "@trumbo-code/contracts";
import {
  resolveTrumboModelAccessMessage,
  TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE,
  TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE,
} from "@trumbo-code/shared/trumboSubscription";

export type TrumboThreadAccessBlock =
  | { readonly kind: "none" }
  | { readonly kind: "sign-in" }
  | { readonly kind: "subscribe" };

export function resolveTrumboThreadAccessBlock(input: {
  readonly isNativeDesktop: boolean;
  readonly authState: TrumboAuthState | undefined;
  readonly threadError: string | null;
  readonly providerMessage: string | null | undefined;
}): TrumboThreadAccessBlock {
  if (!input.isNativeDesktop) {
    return { kind: "none" };
  }

  const authState = input.authState ?? { status: "signed-out" as const };

  if (authState.status !== "signed-in") {
    return { kind: "sign-in" };
  }

  const accessMessage = resolveTrumboModelAccessMessage(authState);
  if (accessMessage === TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE) {
    return { kind: "subscribe" };
  }

  const combined = `${input.threadError ?? ""}\n${input.providerMessage ?? ""}`;
  if (combined.includes(TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE)) {
    return { kind: "subscribe" };
  }
  if (combined.includes(TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE)) {
    return { kind: "sign-in" };
  }

  return { kind: "none" };
}
