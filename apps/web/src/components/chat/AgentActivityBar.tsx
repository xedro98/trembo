import { memo, useMemo } from "react";
import {
  CircleAlertIcon,
  FileEditIcon,
  FileSearchIcon,
  LoaderIcon,
  TerminalIcon,
  BrainIcon,
  CheckCircleIcon,
  WrenchIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";

interface AgentActivityBarProps {
  readonly isWorking: boolean;
  readonly phase: string | null;
  readonly latestAction: string | null;
  readonly hasError: boolean;
  readonly turnSettled: boolean;
}

function resolveActivityIcon(action: string | null, isWorking: boolean, hasError: boolean) {
  if (hasError) return CircleAlertIcon;
  if (!isWorking) return CheckCircleIcon;

  const lower = (action ?? "").toLowerCase();
  if (lower.includes("terminal") || lower.includes("shell") || lower.includes("command")) {
    return TerminalIcon;
  }
  if (lower.includes("edit") || lower.includes("write") || lower.includes("file")) {
    return FileEditIcon;
  }
  if (lower.includes("read") || lower.includes("search") || lower.includes("grep")) {
    return FileSearchIcon;
  }
  if (lower.includes("think") || lower.includes("reason") || lower.includes("plan")) {
    return BrainIcon;
  }
  return WrenchIcon;
}

export const AgentActivityBar = memo(function AgentActivityBar({
  isWorking,
  phase,
  latestAction,
  hasError,
  turnSettled,
}: AgentActivityBarProps) {
  const showBar = isWorking || (hasError && !turnSettled);
  const Icon = useMemo(
    () => resolveActivityIcon(latestAction, isWorking, hasError),
    [latestAction, isWorking, hasError],
  );

  if (!showBar) return null;

  const label = hasError
    ? "Agent encountered an error"
    : (latestAction ?? (phase === "running" ? "Thinking..." : "Working..."));

  return (
    <div className="relative z-10 flex items-center gap-2.5 border-b border-border/60 bg-card/40 px-4 py-2 backdrop-blur-sm sm:px-5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md",
            hasError ? "text-destructive" : "text-primary",
          )}
        >
          {hasError ? (
            <CircleAlertIcon className="size-4" />
          ) : (
            <Icon className={cn("size-4", isWorking && "animate-pulse")} />
          )}
        </span>
        <span
          className={cn(
            "inline-flex h-1.5 w-1.5 shrink-0 rounded-full",
            hasError ? "bg-destructive" : "bg-primary",
            isWorking && !hasError && "animate-status-pulse",
          )}
          aria-hidden
        />
      </div>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {isWorking && !hasError ? (
        <LoaderIcon className="size-3 shrink-0 animate-spin text-muted-foreground/50" />
      ) : null}
    </div>
  );
});
