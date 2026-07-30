// @effect-diagnostics globalFetchInEffect:off globalDate:off globalDateInEffect:off missingEffectError:off unsafeEffectTypeAssertion:off

import { TextGenerationError, type TrumboSubscription } from "@trumbo-code/contracts";
import {
  hasActiveTrumboModelSubscription,
  TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE,
  TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE,
} from "@trumbo-code/shared/trumboSubscription";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as TrumboPlatformTokenManager from "./TrumboPlatformTokenManager.ts";

export {
  hasActiveTrumboModelSubscription,
  TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE,
  TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE,
};

const SUBSCRIPTION_PATH = "/api/billing/subscription";
const CACHE_TTL_MS = 60_000;

const TrumboSubscriptionSchema = Schema.Struct({
  tier: Schema.Union([
    Schema.Literal("free"),
    Schema.Literal("pro"),
    Schema.Literal("max"),
    Schema.Literal("ultra"),
  ]),
  status: Schema.Union([
    Schema.Literal("active"),
    Schema.Literal("trialing"),
    Schema.Literal("past_due"),
    Schema.Literal("canceled"),
    Schema.Literal("none"),
  ]),
  periodEnd: Schema.optional(Schema.String),
  displayName: Schema.optional(Schema.String),
});

const decodeTrumboSubscription = Schema.decodeUnknownOption(TrumboSubscriptionSchema);

let cachedSubscription: {
  readonly token: string;
  readonly fetchedAtMs: number;
  readonly subscription: TrumboSubscription | null;
} | null = null;

export function resolveTrumboPlatformUrl(): string {
  const fromEnv = process.env.TRUMBO_CODE_PLATFORM_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/u, "");
  }
  return "https://platform.trumbo.dev";
}

export function fetchTrumboPlatformSubscription(
  accessToken: string,
): Effect.Effect<TrumboSubscription | null> {
  const normalizedToken = accessToken.trim();
  if (!normalizedToken) {
    return Effect.succeed(null);
  }

  const now = Date.now();
  if (
    cachedSubscription &&
    cachedSubscription.token === normalizedToken &&
    now - cachedSubscription.fetchedAtMs < CACHE_TTL_MS
  ) {
    return Effect.succeed(cachedSubscription.subscription);
  }

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${resolveTrumboPlatformUrl()}${SUBSCRIPTION_PATH}`, {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${normalizedToken}`,
        },
      });
      if (!response.ok) {
        return null;
      }
      const payload = await response.json();
      const decoded = decodeTrumboSubscription(payload);
      const subscription = Option.isSome(decoded) ? (decoded.value as TrumboSubscription) : null;
      cachedSubscription = {
        token: normalizedToken,
        fetchedAtMs: Date.now(),
        subscription,
      };
      return subscription;
    },
    catch: () => null,
  }) as Effect.Effect<TrumboSubscription | null>;
}

export const readTrumboPlatformSubscription = Effect.gen(function* () {
  const tokenManager = yield* TrumboPlatformTokenManager.TrumboPlatformTokenManager;
  const accessToken = yield* tokenManager.getAccessToken;
  if (Option.isNone(accessToken)) {
    return null;
  }
  return yield* fetchTrumboPlatformSubscription(accessToken.value);
});

export const requireTrumboModelAccess = (
  operation: string,
): Effect.Effect<
  { readonly accessToken: string; readonly subscription: TrumboSubscription | null },
  TextGenerationError,
  TrumboPlatformTokenManager.TrumboPlatformTokenManager
> =>
  Effect.gen(function* () {
    const tokenManager = yield* TrumboPlatformTokenManager.TrumboPlatformTokenManager;
    const accessToken = yield* tokenManager.getAccessToken;
    if (Option.isNone(accessToken)) {
      return yield* Effect.fail(
        new TextGenerationError({
          operation,
          detail: TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE,
        }),
      );
    }

    const subscription = yield* fetchTrumboPlatformSubscription(accessToken.value);
    if (!hasActiveTrumboModelSubscription(subscription)) {
      return yield* Effect.fail(
        new TextGenerationError({
          operation,
          detail: TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE,
        }),
      );
    }

    return { accessToken: accessToken.value, subscription };
  });
