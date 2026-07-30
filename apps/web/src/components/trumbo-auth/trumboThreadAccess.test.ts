import type { TrumboAuthState } from "@trumbo-code/contracts";
import {
  TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE,
  TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE,
} from "@trumbo-code/shared/trumboSubscription";
import { describe, expect, it } from "vite-plus/test";

import { resolveTrumboThreadAccessBlock } from "./trumboThreadAccess";

const signedInFree: TrumboAuthState = {
  status: "signed-in",
  user: { id: "user-1", email: "dev@trumbo.dev" },
  subscription: { tier: "free", status: "active" },
  accessToken: "token",
};

describe("resolveTrumboThreadAccessBlock", () => {
  it("requires sign-in on native desktop when auth is still loading", () => {
    expect(
      resolveTrumboThreadAccessBlock({
        isNativeDesktop: true,
        authState: undefined,
        threadError: null,
        providerMessage: null,
      }),
    ).toEqual({ kind: "sign-in" });
  });

  it("requires sign-in on native desktop when signed out", () => {
    expect(
      resolveTrumboThreadAccessBlock({
        isNativeDesktop: true,
        authState: { status: "signed-out" },
        threadError: null,
        providerMessage: null,
      }),
    ).toEqual({ kind: "sign-in" });
  });

  it("requires subscription for signed-in free tier", () => {
    expect(
      resolveTrumboThreadAccessBlock({
        isNativeDesktop: true,
        authState: signedInFree,
        threadError: null,
        providerMessage: null,
      }),
    ).toEqual({ kind: "subscribe" });
  });

  it("ignores auth blocks on non-native hosts", () => {
    expect(
      resolveTrumboThreadAccessBlock({
        isNativeDesktop: false,
        authState: { status: "signed-out" },
        threadError: TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE,
        providerMessage: TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE,
      }),
    ).toEqual({ kind: "none" });
  });

  it("falls back to provider and thread errors when auth subscription is active", () => {
    expect(
      resolveTrumboThreadAccessBlock({
        isNativeDesktop: true,
        authState: {
          status: "signed-in",
          user: { id: "user-1", email: "dev@trumbo.dev" },
          subscription: { tier: "pro", status: "active" },
          accessToken: "token",
        },
        threadError: null,
        providerMessage: TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE,
      }),
    ).toEqual({ kind: "subscribe" });
  });
});
