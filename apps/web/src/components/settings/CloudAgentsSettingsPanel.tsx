import { CloudIcon, LoaderIcon, RefreshCwIcon, UsersIcon } from "lucide-react";
import { useCallback } from "react";

import { DEFAULT_UNIFIED_SETTINGS } from "@trumbo-code/contracts/settings";
import { isNativeTrumboDesktop } from "../../lib/nativeTrumboDesktop";
import { cn } from "../../lib/utils";
import { usePrimarySettings, useUpdatePrimarySettings } from "../../hooks/useSettings";
import { usePrimaryEnvironment } from "../../state/environments";
import { ecosystemEnvironment } from "../../state/ecosystem";
import { useEnvironmentQuery } from "../../state/query";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";
import { useTrumboAuthState } from "../trumbo-auth/useTrumboAuthState";
import { useTrumboConnectAuthPrompt } from "../trumbo-auth/useTrumboConnectAuthPrompt";

function UsageMeter({
  label,
  used,
  limit,
  unit,
}: {
  readonly label: string;
  readonly used: number;
  readonly limit: number;
  readonly unit: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <SettingsRow
      title={label}
      description={`${used.toLocaleString()} / ${limit.toLocaleString()} ${unit}`}
      control={<span className="text-sm font-semibold tabular-nums">{pct}%</span>}
    >
      <div className="pb-3.5">
        <div className="h-2 overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn(
              "h-full rounded-full bg-primary/80 transition-[width] duration-500 ease-out",
              pct >= 80 && "bg-destructive/80",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </SettingsRow>
  );
}

function CloudAgentsUnavailableOnWeb() {
  return (
    <SettingsPageContainer>
      <SettingsSection title="Cloud agents" icon={<CloudIcon className="size-3.5" />}>
        <SettingsRow
          title="Trumbo Agentic Cloud"
          description="Cloud agents, sandboxes, and team tools are available in the Trumbo desktop app."
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}

export function CloudAgentsSettingsPanel() {
  const environmentId = usePrimaryEnvironment()?.environmentId ?? null;
  const authState = useTrumboAuthState();
  const { authPrompt, openAuthPrompt } = useTrumboConnectAuthPrompt();
  const settings = usePrimarySettings();
  const updateSettings = useUpdatePrimarySettings();

  const trumboSettings = settings.providers.trumbo ?? DEFAULT_UNIFIED_SETTINGS.providers.trumbo;
  const enableAgentTeams = trumboSettings.enableAgentTeams ?? true;
  const enableSpawnAgent = trumboSettings.enableSpawnAgent ?? true;

  const infrastructureQuery = useEnvironmentQuery(
    environmentId === null
      ? null
      : ecosystemEnvironment.platformInfrastructure({
          environmentId,
          input: {},
        }),
  );

  const refresh = useCallback(() => {
    infrastructureQuery.refresh();
  }, [infrastructureQuery]);

  const handleAgentTeamsChange = useCallback(
    (checked: boolean) => {
      updateSettings({
        providers: {
          ...settings.providers,
          trumbo: {
            ...trumboSettings,
            enableAgentTeams: checked,
          },
        },
      });
    },
    [updateSettings],
  );

  const handleSpawnAgentChange = useCallback(
    (checked: boolean) => {
      updateSettings({
        providers: {
          ...settings.providers,
          trumbo: {
            ...trumboSettings,
            enableSpawnAgent: checked,
          },
        },
      });
    },
    [updateSettings],
  );

  if (!isNativeTrumboDesktop()) {
    return <CloudAgentsUnavailableOnWeb />;
  }

  if (!environmentId) {
    return (
      <SettingsPageContainer>
        <SettingsSection title="Cloud agents" icon={<CloudIcon className="size-3.5" />}>
          <SettingsRow
            title="Connect an environment"
            description="Open a local server environment to view cloud infrastructure."
          />
        </SettingsSection>
      </SettingsPageContainer>
    );
  }

  if (!authState || authState.status !== "signed-in") {
    return (
      <SettingsPageContainer>
        <SettingsSection title="Cloud agents" icon={<CloudIcon className="size-3.5" />}>
          <SettingsRow
            title="Trumbo Agentic Cloud"
            description="Sign in to view cloud agents, sandboxes, and usage."
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

  const data = infrastructureQuery.data;
  const agents = data?.agents ?? [];
  const sandboxes = data?.sandboxes ?? [];

  return (
    <SettingsPageContainer>
      <SettingsSection title="Agent teams" icon={<UsersIcon className="size-3.5" />}>
        <SettingsRow
          title="Multi-agent teams"
          description="Enable team_spawn_teammate, team_task, and related tools in Trumbo CLI sessions. Use /team in chat to start a coordinated team run."
          control={
            <Switch
              checked={enableAgentTeams}
              onCheckedChange={handleAgentTeamsChange}
              aria-label="Enable agent teams"
            />
          }
        />
        <SettingsRow
          title="Spawn subagents"
          description="Allow spawn_agent delegated subtasks from the main Trumbo agent."
          control={
            <Switch
              checked={enableSpawnAgent}
              onCheckedChange={handleSpawnAgentChange}
              aria-label="Enable spawn agent"
            />
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Cloud infrastructure"
        icon={<CloudIcon className="size-3.5" />}
        headerAction={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Refresh cloud infrastructure"
            onClick={refresh}
            disabled={infrastructureQuery.isPending}
          >
            <RefreshCwIcon
              className={cn("size-3.5", infrastructureQuery.isPending && "animate-spin")}
            />
          </Button>
        }
      >
        {infrastructureQuery.error ? (
          <SettingsRow
            title="Could not load infrastructure"
            description={infrastructureQuery.error}
          />
        ) : data?.error ? (
          <SettingsRow title="Platform unavailable" description={data.error} />
        ) : infrastructureQuery.isPending && data === null ? (
          <SettingsRow
            title="Loading cloud data"
            description="Fetching agents and sandboxes from platform.trumbo.dev…"
            control={<LoaderIcon className="size-4 animate-spin text-muted-foreground" />}
          />
        ) : null}

        {data?.agentsUsage?.enabled ? (
          <UsageMeter
            label="Cloud agent hours"
            used={Math.round(data.agentsUsage.hoursUsed * 10) / 10}
            limit={data.agentsUsage.hoursMonthly}
            unit="hours"
          />
        ) : null}
        {data?.sandboxUsage?.enabled ? (
          <UsageMeter
            label="Sandbox CPU"
            used={data.sandboxUsage.cpuSecondsUsed}
            limit={data.sandboxUsage.cpuSecondsMonthly}
            unit="CPU seconds"
          />
        ) : null}

        {agents.length === 0 ? (
          <SettingsRow
            title="No cloud agents"
            description="Long-running cloud agents appear here when created from the platform or CLI. Open platform.trumbo.dev/agents to create one."
          />
        ) : (
          agents.map((agent) => (
            <SettingsRow
              key={agent.id}
              title={
                <span className="inline-flex items-center gap-2">
                  <span>{agent.name}</span>
                  <Badge variant="secondary">{agent.status}</Badge>
                </span>
              }
              description={
                <span className="font-mono text-[11px] text-muted-foreground/80">
                  {agent.model} · {agent.id}
                </span>
              }
            />
          ))
        )}

        {sandboxes.length > 0 ? (
          sandboxes.map((sandbox) => (
            <SettingsRow
              key={sandbox.id}
              title={
                <span className="inline-flex items-center gap-2">
                  <span>Sandbox</span>
                  <Badge variant="secondary">{sandbox.status}</Badge>
                </span>
              }
              description={
                <span className="font-mono text-[11px] text-muted-foreground/80">
                  {sandbox.id} · {sandbox.reserved_cpu_seconds}s reserved
                </span>
              }
            />
          ))
        ) : (
          <SettingsRow
            title="Sandboxes"
            description="Ephemeral sandboxes for browser runs and isolated execution show up here when active."
          />
        )}
      </SettingsSection>
      {authPrompt}
    </SettingsPageContainer>
  );
}
