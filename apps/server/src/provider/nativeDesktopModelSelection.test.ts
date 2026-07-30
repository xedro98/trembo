import { ProviderInstanceId } from "@trumbo-code/contracts";
import { describe, expect, it } from "vitest";
import {
  defaultNativeDesktopModelSelection,
  NATIVE_DESKTOP_INSTANCE_ID,
  remapModelSelectionForNativeDesktopBuild,
} from "./nativeDesktopModelSelection.ts";

describe("nativeDesktopModelSelection", () => {
  it("remaps unavailable selections on native desktop builds", () => {
    const previousEnv = process.env.TRUMBO_CODE_NATIVE_DESKTOP;
    process.env.TRUMBO_CODE_NATIVE_DESKTOP = "1";
    try {
      expect(
        remapModelSelectionForNativeDesktopBuild(
          {
            instanceId: ProviderInstanceId.make("codex"),
            model: "gpt-5.4",
          },
          false,
        ),
      ).toEqual(defaultNativeDesktopModelSelection());
    } finally {
      if (previousEnv === undefined) {
        delete process.env.TRUMBO_CODE_NATIVE_DESKTOP;
      } else {
        process.env.TRUMBO_CODE_NATIVE_DESKTOP = previousEnv;
      }
    }
  });

  it("preserves available selections on native desktop builds", () => {
    const previousEnv = process.env.TRUMBO_CODE_NATIVE_DESKTOP;
    process.env.TRUMBO_CODE_NATIVE_DESKTOP = "1";
    try {
      const selection = {
        instanceId: NATIVE_DESKTOP_INSTANCE_ID,
        model: "quartz-1.0-hyper",
      };
      expect(remapModelSelectionForNativeDesktopBuild(selection, true)).toEqual(selection);
    } finally {
      if (previousEnv === undefined) {
        delete process.env.TRUMBO_CODE_NATIVE_DESKTOP;
      } else {
        process.env.TRUMBO_CODE_NATIVE_DESKTOP = previousEnv;
      }
    }
  });
});
