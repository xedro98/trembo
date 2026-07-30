import { describe, expect, it } from "vite-plus/test";

import {
  buildDesktopSetupSteps,
  countRequiredIncompleteDesktopSetupSteps,
  findActiveDesktopSetupStep,
  isDesktopSetupComplete,
} from "./DesktopGettingStarted.logic";

describe("buildDesktopSetupSteps", () => {
  it("tracks required setup progress without trumbo sign-in on non-native builds", () => {
    const steps = buildDesktopSetupSteps({
      hasProject: true,
      hasConfiguredProvider: false,
      showProviderStep: true,
      showTrumboSignIn: false,
      isTrumboSignedIn: false,
      hasThread: false,
    });

    expect(steps.map((step) => step.id)).toEqual(["project", "provider", "thread"]);
    expect(countRequiredIncompleteDesktopSetupSteps(steps)).toBe(2);
    expect(isDesktopSetupComplete(steps)).toBe(false);
    expect(findActiveDesktopSetupStep(steps)?.id).toBe("provider");
  });

  it("enforces trumbo sign-in first on native desktop builds", () => {
    const steps = buildDesktopSetupSteps({
      hasProject: false,
      hasConfiguredProvider: false,
      showProviderStep: false,
      showTrumboSignIn: true,
      isTrumboSignedIn: false,
      hasThread: false,
    });

    expect(steps.map((step) => step.id)).toEqual(["trumbo-auth", "project", "thread"]);
    expect(findActiveDesktopSetupStep(steps)?.id).toBe("trumbo-auth");
    expect(isDesktopSetupComplete(steps)).toBe(false);
  });

  it("blocks completion until trumbo sign-in is done on native desktop", () => {
    const steps = buildDesktopSetupSteps({
      hasProject: true,
      hasConfiguredProvider: true,
      showProviderStep: false,
      showTrumboSignIn: true,
      isTrumboSignedIn: false,
      hasThread: true,
    });

    expect(isDesktopSetupComplete(steps)).toBe(false);
    expect(countRequiredIncompleteDesktopSetupSteps(steps)).toBe(1);
    expect(findActiveDesktopSetupStep(steps)?.id).toBe("trumbo-auth");
  });

  it("completes when trumbo sign-in is done on native desktop", () => {
    const steps = buildDesktopSetupSteps({
      hasProject: true,
      hasConfiguredProvider: true,
      showProviderStep: false,
      showTrumboSignIn: true,
      isTrumboSignedIn: true,
      hasThread: true,
    });

    expect(isDesktopSetupComplete(steps)).toBe(true);
    expect(countRequiredIncompleteDesktopSetupSteps(steps)).toBe(0);
    expect(findActiveDesktopSetupStep(steps)).toBeNull();
  });
});
