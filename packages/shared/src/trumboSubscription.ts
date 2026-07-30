import type { TrumboAuthState, TrumboSubscription } from "@trumbo-code/contracts";

export const TRUMBO_PLATFORM_BILLING_URL = "https://platform.trumbo.dev/billing";

export const TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE =
  "Sign in to Trumbo to use Quartz and Trumbo-supported models.";

export const TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE =
  "Subscribe to Trumbo to use Quartz and Trumbo-supported models.";

export function isTrumboSubscriptionStatusActive(
  status: TrumboSubscription["status"] | undefined,
): boolean {
  return status === "active" || status === "trialing";
}

/** Paid Trumbo plan required for Quartz / platform-routed models. */
export function hasActiveTrumboModelSubscription(
  subscription: TrumboSubscription | null | undefined,
): boolean {
  if (!subscription) {
    return false;
  }
  if (!isTrumboSubscriptionStatusActive(subscription.status)) {
    return false;
  }
  return subscription.tier !== "free";
}

export function resolveTrumboModelAccessMessage(
  auth: TrumboAuthState | null | undefined,
): string | null {
  if (!auth || auth.status !== "signed-in") {
    return TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE;
  }
  if (!hasActiveTrumboModelSubscription(auth.subscription)) {
    return TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE;
  }
  return null;
}
