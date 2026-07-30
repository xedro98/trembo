import { describe, expect, it } from "vitest";

import {
  hasActiveTrumboModelSubscription,
  resolveTrumboModelAccessMessage,
  TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE,
  TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE,
} from "./trumboSubscription.ts";

describe("hasActiveTrumboModelSubscription", () => {
  it("requires a paid tier with an active status", () => {
    expect(
      hasActiveTrumboModelSubscription({
        tier: "pro",
        status: "active",
      }),
    ).toBe(true);
    expect(
      hasActiveTrumboModelSubscription({
        tier: "free",
        status: "active",
      }),
    ).toBe(false);
    expect(
      hasActiveTrumboModelSubscription({
        tier: "pro",
        status: "canceled",
      }),
    ).toBe(false);
  });
});

describe("resolveTrumboModelAccessMessage", () => {
  it("prompts sign-in when signed out", () => {
    expect(resolveTrumboModelAccessMessage({ status: "signed-out" })).toBe(
      TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE,
    );
  });

  it("prompts subscribe when signed in without a paid plan", () => {
    expect(
      resolveTrumboModelAccessMessage({
        status: "signed-in",
        subscription: { tier: "free", status: "none" },
      }),
    ).toBe(TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE);
  });

  it("returns null when a paid plan is active", () => {
    expect(
      resolveTrumboModelAccessMessage({
        status: "signed-in",
        subscription: { tier: "pro", status: "active" },
      }),
    ).toBeNull();
  });
});
