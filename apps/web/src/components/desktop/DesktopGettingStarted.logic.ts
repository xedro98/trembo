export type DesktopSetupStepId = "project" | "provider" | "trumbo-auth" | "thread";

export interface DesktopSetupStep {
  readonly id: DesktopSetupStepId;
  readonly title: string;
  readonly description: string;
  readonly complete: boolean;
  readonly optional?: boolean;
}

export function buildDesktopSetupSteps(input: {
  readonly hasProject: boolean;
  readonly hasConfiguredProvider: boolean;
  readonly showProviderStep: boolean;
  readonly showTrumboSignIn: boolean;
  readonly isTrumboSignedIn: boolean;
  readonly hasThread: boolean;
}): ReadonlyArray<DesktopSetupStep> {
  const steps: DesktopSetupStep[] = [];

  // On native desktop, sign-in is enforced first. The user cannot proceed to
  // projects or threads until their Trumbo account is linked because the
  // bundled provider routes every request through the platform token.
  if (input.showTrumboSignIn) {
    steps.push({
      id: "trumbo-auth",
      title: "Sign in to Trumbo",
      description: "Required to use Trumbo Code. Link this device to your Trumbo account.",
      complete: input.isTrumboSignedIn,
    });
  }

  steps.push({
    id: "project",
    title: "Add a project",
    description: "Open a local folder or repository to work in.",
    complete: input.hasProject,
  });

  if (input.showProviderStep) {
    steps.push({
      id: "provider",
      title: "Connect a coding agent",
      description: "Install and authenticate a provider so threads can run.",
      complete: input.hasConfiguredProvider,
    });
  }

  steps.push({
    id: "thread",
    title: "Start a thread",
    description: "Create a conversation to plan, edit, and run commands.",
    complete: input.hasThread,
  });

  return steps;
}

export function countRequiredIncompleteDesktopSetupSteps(
  steps: ReadonlyArray<DesktopSetupStep>,
): number {
  return steps.filter((step) => !step.complete && !step.optional).length;
}

export function isDesktopSetupComplete(steps: ReadonlyArray<DesktopSetupStep>): boolean {
  return countRequiredIncompleteDesktopSetupSteps(steps) === 0;
}

export function findActiveDesktopSetupStep(
  steps: ReadonlyArray<DesktopSetupStep>,
): DesktopSetupStep | null {
  return steps.find((step) => !step.complete && !step.optional) ?? null;
}
