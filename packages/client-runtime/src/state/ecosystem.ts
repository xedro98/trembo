import { WS_METHODS } from "@trumbo-code/contracts";
import { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { createEnvironmentRpcCommand, createEnvironmentRpcQueryAtomFamily } from "./runtime.ts";

export function createEcosystemEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    scheduleList: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:schedule:list",
      tag: WS_METHODS.scheduleList,
    }),
    scheduleActive: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:schedule:active",
      tag: WS_METHODS.scheduleActive,
    }),
    mcpListServers: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:mcp:list",
      tag: WS_METHODS.mcpListServers,
    }),
    platformInfrastructure: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:platform:infrastructure",
      tag: WS_METHODS.platformGetInfrastructure,
    }),
    scheduleCreate: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:schedule:create",
      tag: WS_METHODS.scheduleCreate,
    }),
    scheduleDelete: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:schedule:delete",
      tag: WS_METHODS.scheduleDelete,
    }),
    schedulePause: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:schedule:pause",
      tag: WS_METHODS.schedulePause,
    }),
    scheduleResume: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:schedule:resume",
      tag: WS_METHODS.scheduleResume,
    }),
    scheduleTrigger: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:schedule:trigger",
      tag: WS_METHODS.scheduleTrigger,
    }),
    mcpUpsertServer: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:mcp:upsert",
      tag: WS_METHODS.mcpUpsertServer,
    }),
    mcpToggleServer: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:mcp:toggle",
      tag: WS_METHODS.mcpToggleServer,
    }),
    mcpDeleteServer: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:mcp:delete",
      tag: WS_METHODS.mcpDeleteServer,
    }),
    mcpStartOAuth: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:mcp:oauth",
      tag: WS_METHODS.mcpStartOAuth,
    }),
  };
}

export type EcosystemEnvironmentAtoms = ReturnType<typeof createEcosystemEnvironmentAtoms>;
