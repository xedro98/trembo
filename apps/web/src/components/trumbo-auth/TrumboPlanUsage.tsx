import type { TrumboPlanRateLimitWindow, TrumboSubscription } from "@trumbo-code/contracts";
import { BarChart3Icon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { SettingsRow, SettingsSection } from "../settings/settingsLayout";
import { useTrumboAuthState } from "./useTrumboAuthState";

const TIER_LABELS: Readonly<Record<TrumboSubscription["tier"], string>> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
  ultra: "Ultra",
};

const WINDOW_LABELS: ReadonlyArray<{
  readonly key: keyof NonNullable<TrumboSubscription["usage"]>;
  readonly label: string;
}> = [
  { key: "fiveHour", label: "5-hour" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
];

const PLAN_REFRESH_INTERVAL_MS = 30_000;

function formatResetsIn(resetsAtSec: number | undefined): string | null {
  if (typeof resetsAtSec !== "number" || !Number.isFinite(resetsAtSec)) {
    return null;
  }
  const seconds = resetsAtSec - Math.floor(Date.now() / 1_000);
  if (seconds <= 0) {
    return "now";
  }
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (hours >= 1) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes >= 1) {
    return `${minutes}m`;
  }
  return `${Math.max(1, Math.floor(seconds))}s`;
}

function formatRenewalDate(periodEnd: string): string {
  const date = new Date(periodEnd);
  if (Number.isNaN(date.getTime())) {
    return periodEnd;
  }
  return date.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function UsageWindowRow({
  label,
  window,
}: {
  readonly label: string;
  readonly window: TrumboPlanRateLimitWindow | undefined;
}) {
  const hasData =
    typeof window?.used === "number" && typeof window?.limit === "number" && window.limit > 0;
  const used = hasData ? window.used : 0;
  const limit = hasData ? window.limit : 0;
  const pct = hasData ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const resetsIn = formatResetsIn(window?.resetsAtSec);
  const isHigh = hasData && pct >= 80;

  return (
    <SettingsRow
      title={label}
      description={resetsIn ? `Resets in ${resetsIn}` : "Usage window"}
      control={
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {hasData ? `${used} / ${limit}` : "—"}
        </span>
      }
    >
      <div className="pb-3.5">
        <div className="h-2 overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              isHigh ? "bg-destructive/80" : "bg-primary/80",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </SettingsRow>
  );
}

function getDesktopTrumboAuthRefresh(): (() => Promise<unknown>) | undefined {
  return (
    window as unknown as {
      desktopBridge?: { trumboAuth?: { refresh?: () => Promise<unknown> } };
    }
  ).desktopBridge?.trumboAuth?.refresh;
}

function PlanStatusBadge({ status }: { readonly status: TrumboSubscription["status"] }) {
  if (!status || status === "none") {
    return null;
  }

  return (
    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-primary">
      {status.replace("_", " ")}
    </span>
  );
}

export function useTrumboPlanUsageRefresh() {
  const state = useTrumboAuthState();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(() => Date.now());

  const refreshUsage = useCallback(async () => {
    const refresh = getDesktopTrumboAuthRefresh();
    if (!refresh) return;
    setIsRefreshing(true);
    try {
      await refresh();
      setLastUpdatedAt(Date.now());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!state || state.status !== "signed-in") return;
    void refreshUsage();
    const timer = window.setInterval(() => {
      void refreshUsage();
    }, PLAN_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshUsage, state?.status]);

  return {
    state,
    isRefreshing,
    lastUpdatedAt,
    refreshUsage,
  };
}

/** Full settings-page panel for Trumbo subscription usage. */
export function TrumboPlanUsagePanel() {
  const { state, isRefreshing, lastUpdatedAt, refreshUsage } = useTrumboPlanUsageRefresh();

  if (!state || state.status !== "signed-in") {
    return null;
  }

  const subscription = state.subscription;
  const tier = subscription?.tier ?? "free";
  const usage = subscription?.usage;
  const hasUsage = Boolean(usage?.fiveHour || usage?.daily || usage?.weekly);
  const planLabel = subscription?.displayName?.trim() || TIER_LABELS[tier];
  const tierLabel = TIER_LABELS[tier];
  const showTierSubtitle = planLabel !== tierLabel;

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        title="Subscription"
        icon={<BarChart3Icon className="size-3.5" />}
        headerAction={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Refresh plan usage"
            className="size-5 rounded-sm p-0 text-muted-foreground hover:text-foreground"
            disabled={isRefreshing}
            onClick={() => {
              void refreshUsage();
            }}
          >
            <RefreshCwIcon className={cn("size-3.5", isRefreshing && "animate-spin")} />
          </Button>
        }
      >
        <SettingsRow
          title={planLabel}
          description={showTierSubtitle ? tierLabel : "Your active Trumbo plan"}
          status={
            subscription?.periodEnd ? (
              <span>Renews {formatRenewalDate(subscription.periodEnd)}</span>
            ) : null
          }
          control={subscription?.status ? <PlanStatusBadge status={subscription.status} /> : null}
        />

        <div className="border-t border-border/60 px-4 py-3.5 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
              Request usage
            </h3>
            <span
              className="text-[11px] text-muted-foreground/80"
              title={`Last updated ${new Date(lastUpdatedAt).toLocaleTimeString()}`}
            >
              Updated{" "}
              {new Date(lastUpdatedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>

          {hasUsage ? (
            <div className="-mx-4 sm:-mx-5">
              {WINDOW_LABELS.map(({ key, label }) => (
                <UsageWindowRow key={key} label={label} window={usage?.[key]} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/80">
              {tier === "free"
                ? "Subscribe to Trumbo to unlock Quartz models and request limits."
                : "Usage data is unavailable right now. Try refreshing in a moment."}
            </p>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
