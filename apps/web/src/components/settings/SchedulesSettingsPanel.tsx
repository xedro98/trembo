import {
  CalendarClockIcon,
  LoaderIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import type { EnvironmentId, ScheduleCreateInput, ScheduleRecord } from "@trumbo-code/contracts";
import { useCallback, useMemo, useState } from "react";

import { isNativeTrumboDesktop } from "../../lib/nativeTrumboDesktop";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { usePrimaryEnvironment } from "../../state/environments";
import { useProjects } from "../../state/entities";
import { ecosystemEnvironment } from "../../state/ecosystem";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { cn } from "../../lib/utils";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";
import { useTrumboConnectAuthPrompt } from "../trumbo-auth/useTrumboConnectAuthPrompt";
import { useTrumboAuthState } from "../trumbo-auth/useTrumboAuthState";

function formatScheduleTimestamp(value: number | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const ms = value > 1_000_000_000_000 ? value : value * 1_000;
  return formatRelativeTimeLabel(new Date(ms).toISOString());
}

function ScheduleRow({
  schedule,
  onRefresh,
  environmentId,
}: {
  readonly schedule: ScheduleRecord;
  readonly onRefresh: () => void;
  readonly environmentId: EnvironmentId;
}) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const scheduleDelete = useAtomCommand(ecosystemEnvironment.scheduleDelete, {
    reportFailure: false,
  });
  const schedulePause = useAtomCommand(ecosystemEnvironment.schedulePause, {
    reportFailure: false,
  });
  const scheduleResume = useAtomCommand(ecosystemEnvironment.scheduleResume, {
    reportFailure: false,
  });
  const scheduleTrigger = useAtomCommand(ecosystemEnvironment.scheduleTrigger, {
    reportFailure: false,
  });

  const runAction = useCallback(
    async (action: string, runner: () => Promise<unknown>) => {
      setBusyAction(action);
      try {
        await runner();
        onRefresh();
        toastManager.add(
          stackedThreadToast({
            type: "success",
            title: action,
            description: `"${schedule.name}" updated.`,
          }),
        );
      } catch (error) {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: `Could not ${action.toLowerCase()}`,
            description: error instanceof Error ? error.message : "Schedule action failed.",
          }),
        );
      } finally {
        setBusyAction(null);
      }
    },
    [onRefresh, schedule.name],
  );

  const nextRun = formatScheduleTimestamp(schedule.nextRunAt);
  const lastRun = formatScheduleTimestamp(schedule.lastRunAt);

  return (
    <SettingsRow
      title={
        <span className="inline-flex items-center gap-2">
          <span>{schedule.name}</span>
          <Badge variant={schedule.enabled ? "default" : "secondary"}>
            {schedule.enabled ? "Active" : "Paused"}
          </Badge>
        </span>
      }
      description={
        <span className="space-y-1">
          <span className="block font-mono text-[11px] text-muted-foreground/90">
            {schedule.cronPattern}
          </span>
          <span className="block line-clamp-2">{schedule.prompt}</span>
          {nextRun ? (
            <span className="block text-[11px] text-muted-foreground/70">Next run {nextRun}</span>
          ) : null}
          {lastRun ? (
            <span className="block text-[11px] text-muted-foreground/70">Last run {lastRun}</span>
          ) : null}
        </span>
      }
      control={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Run now"
            disabled={busyAction !== null}
            onClick={() =>
              void runAction("Triggered", () =>
                scheduleTrigger({
                  environmentId,
                  input: { scheduleId: schedule.scheduleId },
                }),
              )
            }
          >
            {busyAction === "Triggered" ? (
              <LoaderIcon className="size-3.5 animate-spin" />
            ) : (
              <ZapIcon className="size-3.5" />
            )}
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={schedule.enabled ? "Pause schedule" : "Resume schedule"}
            disabled={busyAction !== null}
            onClick={() =>
              void runAction(schedule.enabled ? "Paused" : "Resumed", () =>
                schedule.enabled
                  ? schedulePause({
                      environmentId,
                      input: { scheduleId: schedule.scheduleId },
                    })
                  : scheduleResume({
                      environmentId,
                      input: { scheduleId: schedule.scheduleId },
                    }),
              )
            }
          >
            {busyAction === "Paused" || busyAction === "Resumed" ? (
              <LoaderIcon className="size-3.5 animate-spin" />
            ) : schedule.enabled ? (
              <PauseIcon className="size-3.5" />
            ) : (
              <PlayIcon className="size-3.5" />
            )}
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Delete schedule"
            disabled={busyAction !== null}
            onClick={() =>
              void runAction("Deleted", () =>
                scheduleDelete({
                  environmentId,
                  input: { scheduleId: schedule.scheduleId },
                }),
              )
            }
          >
            {busyAction === "Deleted" ? (
              <LoaderIcon className="size-3.5 animate-spin" />
            ) : (
              <Trash2Icon className="size-3.5 text-destructive/80" />
            )}
          </Button>
        </div>
      }
    />
  );
}

function CreateScheduleDialog({
  environmentId,
  defaultWorkspaceRoot,
  onCreated,
}: {
  readonly environmentId: EnvironmentId;
  readonly defaultWorkspaceRoot: string;
  readonly onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cronPattern, setCronPattern] = useState("0 9 * * 1-5");
  const [prompt, setPrompt] = useState("");
  const [workspaceRoot, setWorkspaceRoot] = useState(defaultWorkspaceRoot);
  const [mode, setMode] = useState<"act" | "plan">("act");
  const [enabled, setEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scheduleCreate = useAtomCommand(ecosystemEnvironment.scheduleCreate, {
    reportFailure: false,
  });

  const resetForm = useCallback(() => {
    setName("");
    setCronPattern("0 9 * * 1-5");
    setPrompt("");
    setWorkspaceRoot(defaultWorkspaceRoot);
    setMode("act");
    setEnabled(true);
  }, [defaultWorkspaceRoot]);

  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedPrompt = prompt.trim();
    const trimmedWorkspace = workspaceRoot.trim() || defaultWorkspaceRoot;
    if (!trimmedName || !cronPattern.trim() || !trimmedPrompt || !trimmedWorkspace) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Missing fields",
          description: "Name, cron pattern, prompt, and workspace are required.",
        }),
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const input: ScheduleCreateInput = {
        name: trimmedName,
        cronPattern: cronPattern.trim(),
        prompt: trimmedPrompt,
        workspaceRoot: trimmedWorkspace,
        mode,
        enabled,
        provider: "trumbo",
      };
      await scheduleCreate({ environmentId, input });
      onCreated();
      setOpen(false);
      resetForm();
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: "Schedule created",
          description: `"${trimmedName}" is ready.`,
        }),
      );
    } catch (error) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not create schedule",
          description: error instanceof Error ? error.message : "Schedule creation failed.",
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    cronPattern,
    defaultWorkspaceRoot,
    enabled,
    environmentId,
    mode,
    name,
    onCreated,
    prompt,
    resetForm,
    scheduleCreate,
    workspaceRoot,
  ]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5">
            <PlusIcon className="size-3.5" />
            New schedule
          </Button>
        }
      />
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create scheduled agent</DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Morning standup prep"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Cron pattern</span>
            <Input
              value={cronPattern}
              onChange={(event) => setCronPattern(event.target.value)}
              placeholder="0 9 * * 1-5"
              className="font-mono"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Prompt</span>
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Summarize open PRs and flag blockers"
              rows={3}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Workspace root</span>
            <Input
              value={workspaceRoot}
              onChange={(event) => setWorkspaceRoot(event.target.value)}
              placeholder={defaultWorkspaceRoot}
              className="font-mono text-[12px]"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-medium text-muted-foreground">Mode</label>
            <Select value={mode} onValueChange={(value) => setMode(value as "act" | "plan")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="act">Act</SelectItem>
                <SelectItem value="plan">Plan</SelectItem>
              </SelectPopup>
            </Select>
          </div>
          <SettingsRow
            title="Enabled"
            description="Paused schedules stay saved but do not run on cron."
            control={
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                aria-label="Schedule enabled"
              />
            }
          />
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button disabled={isSubmitting} onClick={() => void handleCreate()}>
            {isSubmitting ? <LoaderIcon className="size-3.5 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function SchedulesUnavailableOnWeb() {
  return (
    <SettingsPageContainer>
      <SettingsSection title="Schedules" icon={<CalendarClockIcon className="size-3.5" />}>
        <SettingsRow
          title="Scheduled agents"
          description="Cron-based agent runs are managed in the Trumbo desktop app via `trumbo schedule`."
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}

export function SchedulesSettingsPanel() {
  const primaryEnvironment = usePrimaryEnvironment();
  const environmentId = primaryEnvironment?.environmentId ?? null;
  const projects = useProjects();
  const authState = useTrumboAuthState();
  const { authPrompt, openAuthPrompt } = useTrumboConnectAuthPrompt();

  const defaultWorkspaceRoot = useMemo(() => {
    const match = projects.find((project) => project.environmentId === environmentId);
    return match?.workspaceRoot ?? "";
  }, [environmentId, projects]);

  const scheduleListQuery = useEnvironmentQuery(
    environmentId === null
      ? null
      : ecosystemEnvironment.scheduleList({
          environmentId,
          input: {},
        }),
  );

  const scheduleActiveQuery = useEnvironmentQuery(
    environmentId === null
      ? null
      : ecosystemEnvironment.scheduleActive({
          environmentId,
          input: {},
        }),
  );

  const refresh = useCallback(() => {
    scheduleListQuery.refresh();
    scheduleActiveQuery.refresh();
  }, [scheduleActiveQuery, scheduleListQuery]);

  if (!isNativeTrumboDesktop()) {
    return <SchedulesUnavailableOnWeb />;
  }

  if (!environmentId) {
    return (
      <SettingsPageContainer>
        <SettingsSection title="Schedules" icon={<CalendarClockIcon className="size-3.5" />}>
          <SettingsRow
            title="Connect an environment"
            description="Open a local server environment to manage scheduled agent runs."
          />
        </SettingsSection>
      </SettingsPageContainer>
    );
  }

  if (!authState || authState.status !== "signed-in") {
    return (
      <SettingsPageContainer>
        <SettingsSection title="Schedules" icon={<CalendarClockIcon className="size-3.5" />}>
          <SettingsRow
            title="Scheduled agents"
            description="Sign in to Trumbo to create and manage cron-based agent runs."
            control={
              <Button size="sm" variant="outline" onClick={() => void openAuthPrompt()}>
                Sign in
              </Button>
            }
          />
        </SettingsSection>
        {authPrompt}
      </SettingsPageContainer>
    );
  }

  const schedules = scheduleListQuery.data?.schedules ?? [];
  const activeExecutions = scheduleActiveQuery.data?.executions ?? [];
  const isLoading = scheduleListQuery.isPending && scheduleListQuery.data === null;
  const listError = scheduleListQuery.error;

  return (
    <SettingsPageContainer>
      <SettingsSection
        title="Schedules"
        icon={<CalendarClockIcon className="size-3.5" />}
        headerAction={
          <div className="flex items-center gap-1">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Refresh schedules"
              onClick={refresh}
              disabled={scheduleListQuery.isPending}
            >
              <RefreshCwIcon
                className={cn("size-3.5", scheduleListQuery.isPending && "animate-spin")}
              />
            </Button>
            <CreateScheduleDialog
              environmentId={environmentId}
              defaultWorkspaceRoot={defaultWorkspaceRoot}
              onCreated={refresh}
            />
          </div>
        }
      >
        {listError ? (
          <SettingsRow title="Could not load schedules" description={listError} />
        ) : isLoading ? (
          <SettingsRow
            title="Loading schedules"
            description="Fetching schedules from Trumbo CLI…"
            control={<LoaderIcon className="size-4 animate-spin text-muted-foreground" />}
          />
        ) : schedules.length === 0 ? (
          <SettingsRow
            title="No schedules yet"
            description="Create a cron job that runs Trumbo Agent on a workspace with a fixed prompt."
          />
        ) : (
          schedules.map((schedule) => (
            <ScheduleRow
              key={schedule.scheduleId}
              schedule={schedule}
              environmentId={environmentId}
              onRefresh={refresh}
            />
          ))
        )}
      </SettingsSection>

      {activeExecutions.length > 0 ? (
        <SettingsSection title="Active runs">
          {activeExecutions.map((execution) => (
            <SettingsRow
              key={execution.executionId}
              title={execution.scheduleId}
              description={
                <span className="font-mono text-[11px]">
                  {execution.status}
                  {execution.sessionId ? ` · session ${execution.sessionId}` : ""}
                </span>
              }
            />
          ))}
        </SettingsSection>
      ) : null}
      {authPrompt}
    </SettingsPageContainer>
  );
}
