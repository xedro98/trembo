// @effect-diagnostics globalFetchInEffect:off

import {
  PlatformEcosystemError,
  type PlatformAgentRow,
  type PlatformAgentsUsage,
  type PlatformInfrastructureResult,
  type PlatformSandboxRow,
  type PlatformSandboxUsage,
} from "@trumbo-code/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as TrumboPlatformTokenManager from "../auth/TrumboPlatformTokenManager.ts";
import { resolveTrumboProviderBaseUrl } from "../provider/trumboCloudClient.ts";

function parseJsonArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as T[];
}

interface PlanResponse {
  agents?: PlatformAgentsUsage;
  sandbox?: PlatformSandboxUsage;
}

export const makePlatformInfrastructureService = () => ({
  getInfrastructure: Effect.gen(function* () {
    const tokenManager = yield* TrumboPlatformTokenManager.TrumboPlatformTokenManager;
    const accessToken = yield* tokenManager.getAccessToken;
    if (Option.isNone(accessToken)) {
      return {
        agents: [],
        sandboxes: [],
        error: "Sign in to Trumbo to view cloud agents and sandboxes.",
      } satisfies PlatformInfrastructureResult;
    }

    const baseUrl = resolveTrumboProviderBaseUrl();
    const headers = {
      Authorization: `Bearer ${accessToken.value}`,
      Accept: "application/json",
    };

    try {
      const { plan, agentsJson, sandboxesJson } = yield* Effect.tryPromise({
        try: async () => {
          const [planResponse, agentsResponse, sandboxesResponse] = await Promise.all([
            fetch(`${baseUrl}/users/me/plan`, { headers }),
            fetch(`${baseUrl}/agents`, { headers }),
            fetch(`${baseUrl}/sandbox`, { headers }),
          ]);
          const plan = planResponse.ok
            ? ((await planResponse.json()) as PlanResponse | null)
            : null;
          const agentsJson = agentsResponse.ok
            ? ((await agentsResponse.json()) as { success?: boolean; data?: unknown })
            : { data: [] };
          const sandboxesJson = sandboxesResponse.ok
            ? ((await sandboxesResponse.json()) as { success?: boolean; data?: unknown })
            : { data: [] };
          return { plan, agentsJson, sandboxesJson };
        },
        catch: (cause) =>
          new PlatformEcosystemError({
            operation: "platform.infrastructure",
            message: cause instanceof Error ? cause.message : String(cause),
          }),
      });

      return {
        agents: parseJsonArray<PlatformAgentRow>(agentsJson.data),
        sandboxes: parseJsonArray<PlatformSandboxRow>(sandboxesJson.data),
        ...(plan?.agents ? { agentsUsage: plan.agents } : {}),
        ...(plan?.sandbox ? { sandboxUsage: plan.sandbox } : {}),
      } satisfies PlatformInfrastructureResult;
    } catch (error) {
      return {
        agents: [],
        sandboxes: [],
        error: error instanceof Error ? error.message : "Failed to fetch platform infrastructure.",
      } satisfies PlatformInfrastructureResult;
    }
  }),
});

export type PlatformInfrastructureService = ReturnType<typeof makePlatformInfrastructureService>;
