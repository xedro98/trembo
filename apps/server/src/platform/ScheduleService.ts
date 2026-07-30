import {
  PlatformEcosystemError,
  type ScheduleCreateInput,
  type ScheduleExecutionRecord,
  type ScheduleListInput,
  type ScheduleRecord,
  type ScheduleStats,
} from "@trumbo-code/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { runTrumboCliJson, type TrumboCliRunnerOptions } from "./trumboCliRunner.ts";

const decodeScheduleRecord = Schema.decodeUnknownSync(
  Schema.Struct({
    scheduleId: Schema.String,
    name: Schema.String,
    cronPattern: Schema.String,
    prompt: Schema.String,
    workspaceRoot: Schema.optional(Schema.String),
    cwd: Schema.optional(Schema.String),
    enabled: Schema.Boolean,
    mode: Schema.optional(Schema.String),
    model: Schema.optional(Schema.String),
    provider: Schema.optional(Schema.String),
    nextRunAt: Schema.optional(Schema.Number),
    lastRunAt: Schema.optional(Schema.Number),
    tags: Schema.optional(Schema.Array(Schema.String)),
    createdAt: Schema.optional(Schema.Number),
    updatedAt: Schema.optional(Schema.Number),
  }),
);

const decodeScheduleList = (value: unknown): ReadonlyArray<ScheduleRecord> => {
  if (Array.isArray(value)) {
    return value.map((entry) => decodeScheduleRecord(entry) as ScheduleRecord);
  }
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { schedules?: unknown }).schedules)
  ) {
    return (value as { schedules: unknown[] }).schedules.map(
      (entry) => decodeScheduleRecord(entry) as ScheduleRecord,
    );
  }
  return [];
};

export const makeScheduleService = (cliOptions: TrumboCliRunnerOptions) => ({
  list: (input: ScheduleListInput) =>
    Effect.gen(function* () {
      const args = ["schedule", "list"];
      if (input.enabled === true) args.push("--enabled");
      if (input.disabled === true) args.push("--disabled");
      if (input.limit !== undefined) args.push("--limit", String(input.limit));
      const raw = yield* runTrumboCliJson(args, cliOptions);
      return { schedules: decodeScheduleList(raw) };
    }),

  create: (input: ScheduleCreateInput, defaultWorkspaceRoot: string) =>
    Effect.gen(function* () {
      const args = [
        "schedule",
        "create",
        input.name,
        "--cron",
        input.cronPattern,
        "--prompt",
        input.prompt,
        "--workspace",
        input.workspaceRoot || defaultWorkspaceRoot,
        "--provider",
        input.provider ?? "trumbo",
        "--model",
        input.model ?? "anthropic/claude-sonnet-4.6",
      ];
      if (input.cwd?.trim()) args.push("--cwd", input.cwd.trim());
      if (input.mode === "plan") args.push("--mode", "plan");
      if (input.enabled === false) args.push("--disabled");
      if (input.tags?.length) args.push("--tags", input.tags.join(","));
      const raw = yield* runTrumboCliJson(args, cliOptions);
      return decodeScheduleRecord(raw) as ScheduleRecord;
    }),

  delete: (scheduleId: string) =>
    Effect.gen(function* () {
      yield* runTrumboCliJson(["schedule", "delete", scheduleId], cliOptions);
      return { deleted: true as const };
    }),

  pause: (scheduleId: string) =>
    Effect.gen(function* () {
      const raw = yield* runTrumboCliJson(["schedule", "pause", scheduleId], cliOptions);
      return decodeScheduleRecord(raw) as ScheduleRecord;
    }),

  resume: (scheduleId: string) =>
    Effect.gen(function* () {
      const raw = yield* runTrumboCliJson(["schedule", "resume", scheduleId], cliOptions);
      return decodeScheduleRecord(raw) as ScheduleRecord;
    }),

  trigger: (scheduleId: string) =>
    Effect.gen(function* () {
      const raw = yield* runTrumboCliJson(["schedule", "trigger", scheduleId], cliOptions);
      const execution =
        raw && typeof raw === "object" && "executionId" in (raw as object)
          ? (raw as ScheduleExecutionRecord)
          : raw && typeof raw === "object" && "execution" in (raw as object)
            ? (raw as { execution: ScheduleExecutionRecord }).execution
            : undefined;
      if (!execution) {
        return yield* Effect.fail(
          new PlatformEcosystemError({
            operation: "schedule.trigger",
            message: "Trumbo CLI did not return an execution record.",
          }),
        );
      }
      return { execution };
    }),

  active: () =>
    Effect.gen(function* () {
      const raw = yield* runTrumboCliJson(["schedule", "active"], cliOptions);
      const executions = Array.isArray(raw)
        ? raw
        : raw &&
            typeof raw === "object" &&
            Array.isArray((raw as { executions?: unknown }).executions)
          ? (raw as { executions: ScheduleExecutionRecord[] }).executions
          : [];
      return { executions };
    }),

  executions: (scheduleId: string, limit?: number) =>
    Effect.gen(function* () {
      const args = ["schedule", "history", scheduleId];
      if (limit !== undefined) args.push("--limit", String(limit));
      const raw = yield* runTrumboCliJson(args, cliOptions);
      const executions = Array.isArray(raw)
        ? raw
        : raw &&
            typeof raw === "object" &&
            Array.isArray((raw as { executions?: unknown }).executions)
          ? (raw as { executions: ScheduleExecutionRecord[] }).executions
          : [];
      return { executions };
    }),

  stats: (scheduleId: string) =>
    Effect.gen(function* () {
      const raw = yield* runTrumboCliJson(["schedule", "stats", scheduleId], cliOptions);
      const stats =
        raw && typeof raw === "object" && "totalRuns" in (raw as object)
          ? (raw as ScheduleStats)
          : raw && typeof raw === "object" && "stats" in (raw as object)
            ? (raw as { stats: ScheduleStats }).stats
            : undefined;
      if (!stats) {
        return yield* Effect.fail(
          new PlatformEcosystemError({
            operation: "schedule.stats",
            message: "Trumbo CLI did not return schedule stats.",
          }),
        );
      }
      return { stats };
    }),
});

export type ScheduleService = ReturnType<typeof makeScheduleService>;
