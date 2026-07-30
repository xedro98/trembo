import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import type { TrumboSubscription, TrumboSubscriptionTier } from "@trumbo-code/contracts";

export const SUBSCRIPTION_PATH = "/api/billing/subscription";

export const TIER_REQUEST_LIMITS: Readonly<
  Record<
    TrumboSubscriptionTier,
    {
      readonly requestsPerHour: number;
      readonly requestsPerDay: number;
      readonly concurrentSessions: number;
    }
  >
> = {
  free: { requestsPerHour: 20, requestsPerDay: 50, concurrentSessions: 1 },
  pro: { requestsPerHour: 100, requestsPerDay: 500, concurrentSessions: 3 },
  max: { requestsPerHour: 500, requestsPerDay: 5_000, concurrentSessions: 10 },
  ultra: {
    requestsPerHour: Number.POSITIVE_INFINITY,
    requestsPerDay: Number.POSITIVE_INFINITY,
    concurrentSessions: Number.POSITIVE_INFINITY,
  },
};

export const TIER_LABELS: Readonly<Record<TrumboSubscriptionTier, string>> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
  ultra: "Ultra",
};

export const TIER_RANK: Readonly<Record<TrumboSubscriptionTier, number>> = {
  free: 0,
  pro: 1,
  max: 2,
  ultra: 3,
};

export type TrumboFeatureGate =
  | "remote-environments"
  | "managed-relay"
  | "wsl-backend"
  | "ssh-connections"
  | "parallel-threads"
  | "nightly-channel";

const FEATURE_MIN_TIER: Readonly<Record<TrumboFeatureGate, TrumboSubscriptionTier>> = {
  "remote-environments": "pro",
  "managed-relay": "pro",
  "wsl-backend": "pro",
  "ssh-connections": "pro",
  "parallel-threads": "max",
  "nightly-channel": "max",
};

export interface TrumboSubscriptionSnapshot {
  readonly tier: TrumboSubscriptionTier;
  readonly status: TrumboSubscription["status"];
  readonly active: boolean;
  readonly rateLimits: (typeof TIER_REQUEST_LIMITS)[TrumboSubscriptionTier];
}

function isActiveStatus(status: TrumboSubscription["status"]): boolean {
  return status === "active" || status === "trialing";
}

export function resolveSubscriptionSnapshot(
  subscription: TrumboSubscription | undefined,
): TrumboSubscriptionSnapshot {
  if (!subscription) {
    return {
      tier: "free",
      status: "none",
      active: false,
      rateLimits: TIER_REQUEST_LIMITS.free,
    };
  }
  const active = isActiveStatus(subscription.status);
  const tier = active ? subscription.tier : "free";
  return {
    tier,
    status: subscription.status,
    active,
    rateLimits: TIER_REQUEST_LIMITS[tier],
  };
}

export function canUseFeature(
  subscription: TrumboSubscription | undefined,
  feature: TrumboFeatureGate,
): boolean {
  const snapshot = resolveSubscriptionSnapshot(subscription);
  const minTier = FEATURE_MIN_TIER[feature];
  return TIER_RANK[snapshot.tier] >= TIER_RANK[minTier];
}

export function gateFeatureMessage(feature: TrumboFeatureGate): string {
  const minTier = FEATURE_MIN_TIER[feature];
  return `Trumbo ${TIER_LABELS[minTier]} or higher is required for this feature.`;
}

export class DesktopTrumboSubscription extends Context.Service<
  DesktopTrumboSubscription,
  {
    readonly getSnapshot: Effect.Effect<TrumboSubscriptionSnapshot>;
    readonly canUseFeature: (feature: TrumboFeatureGate) => Effect.Effect<boolean>;
    readonly refresh: (
      subscription: TrumboSubscription | undefined,
    ) => Effect.Effect<TrumboSubscriptionSnapshot>;
  }
>()("@trumbo-code/desktop/app/DesktopTrumboSubscription") {}

export const make = Effect.gen(function* () {
  const subscriptionRef = yield* Ref.make<TrumboSubscription | undefined>(undefined);

  return DesktopTrumboSubscription.of({
    getSnapshot: Effect.map(Ref.get(subscriptionRef), resolveSubscriptionSnapshot),
    canUseFeature: (feature) =>
      Effect.map(Ref.get(subscriptionRef), (snapshot) => canUseFeature(snapshot, feature)),
    refresh: (subscription) =>
      Effect.map(Ref.set(subscriptionRef, subscription), () =>
        resolveSubscriptionSnapshot(subscription),
      ),
  });
});

export const layer = Layer.effect(DesktopTrumboSubscription, make);
