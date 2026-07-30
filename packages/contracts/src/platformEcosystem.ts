import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString, TrimmedString } from "./baseSchemas.ts";

export const ScheduleMode = Schema.Literals(["act", "plan"]);
export type ScheduleMode = typeof ScheduleMode.Type;

export const ScheduleRecord = Schema.Struct({
  scheduleId: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  cronPattern: TrimmedNonEmptyString,
  prompt: TrimmedNonEmptyString,
  workspaceRoot: TrimmedString,
  cwd: Schema.optionalKey(TrimmedString),
  enabled: Schema.Boolean,
  mode: Schema.optionalKey(ScheduleMode),
  model: Schema.optionalKey(TrimmedString),
  provider: Schema.optionalKey(TrimmedString),
  nextRunAt: Schema.optionalKey(Schema.Number),
  lastRunAt: Schema.optionalKey(Schema.Number),
  tags: Schema.optionalKey(Schema.Array(TrimmedString)),
  createdAt: Schema.optionalKey(Schema.Number),
  updatedAt: Schema.optionalKey(Schema.Number),
});
export type ScheduleRecord = typeof ScheduleRecord.Type;

export const ScheduleExecutionRecord = Schema.Struct({
  executionId: TrimmedNonEmptyString,
  scheduleId: TrimmedNonEmptyString,
  status: TrimmedNonEmptyString,
  sessionId: Schema.optionalKey(TrimmedString),
  triggeredAt: Schema.optionalKey(Schema.Number),
  startedAt: Schema.optionalKey(Schema.Number),
  endedAt: Schema.optionalKey(Schema.Number),
  errorMessage: Schema.optionalKey(TrimmedString),
});
export type ScheduleExecutionRecord = typeof ScheduleExecutionRecord.Type;

export const ScheduleStats = Schema.Struct({
  totalRuns: Schema.Number,
  successRate: Schema.Number,
  avgDurationSeconds: Schema.Number,
  lastFailure: Schema.optionalKey(
    Schema.Struct({
      errorMessage: Schema.optionalKey(TrimmedString),
    }),
  ),
});
export type ScheduleStats = typeof ScheduleStats.Type;

export const ScheduleListInput = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  disabled: Schema.optionalKey(Schema.Boolean),
  limit: Schema.optionalKey(Schema.Number),
});
export type ScheduleListInput = typeof ScheduleListInput.Type;

export const ScheduleCreateInput = Schema.Struct({
  name: TrimmedNonEmptyString,
  cronPattern: TrimmedNonEmptyString,
  prompt: TrimmedNonEmptyString,
  workspaceRoot: TrimmedNonEmptyString,
  cwd: Schema.optionalKey(TrimmedString),
  mode: Schema.optionalKey(ScheduleMode),
  model: Schema.optionalKey(TrimmedString),
  provider: Schema.optionalKey(TrimmedString),
  enabled: Schema.optionalKey(Schema.Boolean),
  tags: Schema.optionalKey(Schema.Array(TrimmedString)),
});
export type ScheduleCreateInput = typeof ScheduleCreateInput.Type;

export const ScheduleIdInput = Schema.Struct({
  scheduleId: TrimmedNonEmptyString,
});
export type ScheduleIdInput = typeof ScheduleIdInput.Type;

export const ScheduleExecutionsInput = Schema.Struct({
  scheduleId: TrimmedNonEmptyString,
  limit: Schema.optionalKey(Schema.Number),
});
export type ScheduleExecutionsInput = typeof ScheduleExecutionsInput.Type;

export const ScheduleListResult = Schema.Struct({
  schedules: Schema.Array(ScheduleRecord),
});
export type ScheduleListResult = typeof ScheduleListResult.Type;

export const ScheduleActiveResult = Schema.Struct({
  executions: Schema.Array(ScheduleExecutionRecord),
});
export type ScheduleActiveResult = typeof ScheduleActiveResult.Type;

export const ScheduleExecutionResult = Schema.Struct({
  execution: ScheduleExecutionRecord,
});
export type ScheduleExecutionResult = typeof ScheduleExecutionResult.Type;

export const ScheduleStatsResult = Schema.Struct({
  stats: ScheduleStats,
});
export type ScheduleStatsResult = typeof ScheduleStatsResult.Type;

export const McpTransportType = Schema.Literals(["stdio", "sse", "streamableHttp"]);
export type McpTransportType = typeof McpTransportType.Type;

export const McpServerSummary = Schema.Struct({
  name: TrimmedNonEmptyString,
  transportType: McpTransportType,
  transportLabel: TrimmedNonEmptyString,
  disabled: Schema.Boolean,
  authLabel: TrimmedNonEmptyString,
  managedBy: Schema.optionalKey(TrimmedString),
  oauthError: Schema.optionalKey(TrimmedString),
});
export type McpServerSummary = typeof McpServerSummary.Type;

export const McpServerListResult = Schema.Struct({
  settingsPath: TrimmedNonEmptyString,
  servers: Schema.Array(McpServerSummary),
});
export type McpServerListResult = typeof McpServerListResult.Type;

export const McpServerNameInput = Schema.Struct({
  name: TrimmedNonEmptyString,
});
export type McpServerNameInput = typeof McpServerNameInput.Type;

export const McpServerUpsertInput = Schema.Struct({
  name: TrimmedNonEmptyString,
  transportType: McpTransportType,
  command: Schema.optionalKey(TrimmedString),
  args: Schema.optionalKey(Schema.Array(TrimmedString)),
  env: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  url: Schema.optionalKey(TrimmedString),
  headers: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  authMode: Schema.optionalKey(Schema.Literals(["none", "headers", "oauth"])),
});
export type McpServerUpsertInput = typeof McpServerUpsertInput.Type;

export const McpOAuthStartResult = Schema.Struct({
  message: TrimmedNonEmptyString,
  authorizationUrl: Schema.optionalKey(TrimmedNonEmptyString),
});
export type McpOAuthStartResult = typeof McpOAuthStartResult.Type;

export const PlatformAgentRow = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  model: TrimmedNonEmptyString,
  status: TrimmedNonEmptyString,
  created_at: Schema.Number,
  updated_at: Schema.Number,
});
export type PlatformAgentRow = typeof PlatformAgentRow.Type;

export const PlatformSandboxRow = Schema.Struct({
  id: TrimmedNonEmptyString,
  status: TrimmedNonEmptyString,
  reserved_cpu_seconds: Schema.Number,
  created_at: Schema.Number,
  updated_at: Schema.Number,
});
export type PlatformSandboxRow = typeof PlatformSandboxRow.Type;

export const PlatformAgentsUsage = Schema.Struct({
  enabled: Schema.Boolean,
  hoursMonthly: Schema.Number,
  hoursUsed: Schema.Number,
  resetsAtSec: Schema.Number,
  concurrentAgents: Schema.Number,
  concurrentUsed: Schema.Number,
});
export type PlatformAgentsUsage = typeof PlatformAgentsUsage.Type;

export const PlatformSandboxUsage = Schema.Struct({
  enabled: Schema.Boolean,
  cpuSecondsMonthly: Schema.Number,
  cpuSecondsUsed: Schema.Number,
  resetsAtSec: Schema.Number,
  concurrentSandboxes: Schema.Number,
  concurrentUsed: Schema.Number,
  maxBackups: Schema.optionalKey(Schema.Number),
});
export type PlatformSandboxUsage = typeof PlatformSandboxUsage.Type;

export const PlatformInfrastructureResult = Schema.Struct({
  agents: Schema.Array(PlatformAgentRow),
  sandboxes: Schema.Array(PlatformSandboxRow),
  agentsUsage: Schema.optionalKey(PlatformAgentsUsage),
  sandboxUsage: Schema.optionalKey(PlatformSandboxUsage),
  error: Schema.optionalKey(TrimmedString),
});
export type PlatformInfrastructureResult = typeof PlatformInfrastructureResult.Type;

export class PlatformEcosystemError extends Schema.TaggedErrorClass<PlatformEcosystemError>()(
  "PlatformEcosystemError",
  {
    operation: TrimmedNonEmptyString,
    message: TrimmedNonEmptyString,
  },
) {}

export const PLATFORM_ECOSYSTEM_WS_METHODS = {
  scheduleList: "schedule.list",
  scheduleCreate: "schedule.create",
  scheduleDelete: "schedule.delete",
  schedulePause: "schedule.pause",
  scheduleResume: "schedule.resume",
  scheduleTrigger: "schedule.trigger",
  scheduleActive: "schedule.active",
  scheduleExecutions: "schedule.executions",
  scheduleStats: "schedule.stats",
  mcpListServers: "mcp.listServers",
  mcpUpsertServer: "mcp.upsertServer",
  mcpToggleServer: "mcp.toggleServer",
  mcpDeleteServer: "mcp.deleteServer",
  mcpStartOAuth: "mcp.startOAuth",
  platformGetInfrastructure: "platform.getInfrastructure",
} as const;
