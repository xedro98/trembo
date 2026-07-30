import {
  KeyRoundIcon,
  LoaderIcon,
  PlugIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import type {
  EnvironmentId,
  McpServerSummary,
  McpServerUpsertInput,
  McpTransportType,
} from "@trumbo-code/contracts";
import { useCallback, useMemo, useState } from "react";

import * as Option from "effect/Option";
import { AsyncResult } from "effect/unstable/reactivity";
import { squashAtomCommandFailure } from "@trumbo-code/client-runtime/state/runtime";
import { isNativeTrumboDesktop } from "../../lib/nativeTrumboDesktop";
import { cn } from "../../lib/utils";
import { usePrimaryEnvironment } from "../../state/environments";
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
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";

async function openUrlInBrowser(url: string): Promise<void> {
  const bridge = (
    window as unknown as { desktopBridge?: { openExternal?: (url: string) => Promise<void> } }
  ).desktopBridge;
  if (bridge?.openExternal) {
    await bridge.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

type AuthMode = "none" | "headers" | "oauth";

function parseArgsText(value: string): string[] {
  return value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseEnvText(value: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of value.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const envValue = trimmed.slice(separator + 1).trim();
    if (key) env[key] = envValue;
  }
  return env;
}

function parseHeadersText(value: string): Record<string, string> {
  return parseEnvText(value);
}

function McpServerWizardDialog({
  environmentId,
  onSaved,
  editServer,
}: {
  readonly environmentId: EnvironmentId;
  readonly onSaved: () => void;
  readonly editServer?: McpServerSummary | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [transportType, setTransportType] = useState<McpTransportType>("stdio");
  const [command, setCommand] = useState("");
  const [argsText, setArgsText] = useState("");
  const [envText, setEnvText] = useState("");
  const [url, setUrl] = useState("");
  const [headersText, setHeadersText] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("none");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mcpUpsertServer = useAtomCommand(ecosystemEnvironment.mcpUpsertServer, {
    reportFailure: false,
  });

  const resetFromEdit = useCallback(() => {
    if (!editServer) {
      setName("");
      setTransportType("stdio");
      setCommand("");
      setArgsText("");
      setEnvText("");
      setUrl("");
      setHeadersText("");
      setAuthMode("none");
      return;
    }
    setName(editServer.name);
    setTransportType(editServer.transportType);
    if (editServer.transportType === "stdio") {
      const label = editServer.transportLabel.replace(/^stdio:\s*/, "");
      setCommand(label === "unknown" ? "" : label);
    } else {
      const label = editServer.transportLabel.replace(/^(sse|streamableHttp):\s*/, "");
      setUrl(label);
    }
    setAuthMode(
      editServer.authLabel.includes("oauth")
        ? "oauth"
        : editServer.authLabel.includes("headers")
          ? "headers"
          : "none",
    );
  }, [editServer]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        resetFromEdit();
      }
    },
    [resetFromEdit],
  );

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Name required",
          description: "Give the MCP server a unique name.",
        }),
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const input: McpServerUpsertInput = {
        name: trimmedName,
        transportType,
        authMode,
        ...(transportType === "stdio"
          ? {
              command: command.trim(),
              ...(parseArgsText(argsText).length > 0 ? { args: parseArgsText(argsText) } : {}),
              ...(Object.keys(parseEnvText(envText)).length > 0
                ? { env: parseEnvText(envText) }
                : {}),
            }
          : {
              url: url.trim(),
              ...(authMode === "headers" && Object.keys(parseHeadersText(headersText)).length > 0
                ? { headers: parseHeadersText(headersText) }
                : {}),
            }),
      };
      await mcpUpsertServer({ environmentId, input });
      onSaved();
      setOpen(false);
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: editServer ? "MCP server updated" : "MCP server added",
          description: trimmedName,
        }),
      );
    } catch (error) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not save MCP server",
          description: error instanceof Error ? error.message : "Save failed.",
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    argsText,
    authMode,
    command,
    editServer,
    envText,
    environmentId,
    headersText,
    mcpUpsertServer,
    name,
    onSaved,
    transportType,
    url,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5">
            <PlusIcon className="size-3.5" />
            {editServer ? "Edit server" : "Add server"}
          </Button>
        }
      />
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editServer ? "Edit MCP server" : "Add MCP server"}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Server name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="github"
              disabled={Boolean(editServer?.managedBy === "trumbo-platform")}
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-medium text-muted-foreground">Transport</label>
            <Select
              value={transportType}
              onValueChange={(value) => setTransportType(value as McpTransportType)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="stdio">stdio (local command)</SelectItem>
                <SelectItem value="sse">SSE (remote URL)</SelectItem>
                <SelectItem value="streamableHttp">Streamable HTTP</SelectItem>
              </SelectPopup>
            </Select>
          </div>
          {transportType === "stdio" ? (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Command</span>
                <Input
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="npx -y @modelcontextprotocol/server-github"
                  className="font-mono text-[12px]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Arguments</span>
                <Input
                  value={argsText}
                  onChange={(event) => setArgsText(event.target.value)}
                  placeholder="Optional space-separated args"
                  className="font-mono text-[12px]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Environment</span>
                <Textarea
                  value={envText}
                  onChange={(event) => setEnvText(event.target.value)}
                  placeholder={"GITHUB_TOKEN=...\nKEY=value"}
                  rows={3}
                  className="font-mono text-[12px]"
                />
              </label>
            </>
          ) : (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Server URL</span>
                <Input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://mcp.example.com/sse"
                  className="font-mono text-[12px]"
                />
              </label>
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-muted-foreground">Authentication</label>
                <Select value={authMode} onValueChange={(value) => setAuthMode(value as AuthMode)}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="headers">Static headers</SelectItem>
                    <SelectItem value="oauth">OAuth</SelectItem>
                  </SelectPopup>
                </Select>
              </div>
              {authMode === "headers" ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Headers</span>
                  <Textarea
                    value={headersText}
                    onChange={(event) => setHeadersText(event.target.value)}
                    placeholder={"Authorization=Bearer ..."}
                    rows={3}
                    className="font-mono text-[12px]"
                  />
                </label>
              ) : null}
            </>
          )}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button disabled={isSubmitting} onClick={() => void handleSave()}>
            {isSubmitting ? <LoaderIcon className="size-3.5 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function McpServerRow({
  server,
  environmentId,
  onRefresh,
}: {
  readonly server: McpServerSummary;
  readonly environmentId: EnvironmentId;
  readonly onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const mcpToggleServer = useAtomCommand(ecosystemEnvironment.mcpToggleServer, {
    reportFailure: false,
  });
  const mcpDeleteServer = useAtomCommand(ecosystemEnvironment.mcpDeleteServer, {
    reportFailure: false,
  });
  const mcpStartOAuth = useAtomCommand(ecosystemEnvironment.mcpStartOAuth, {
    reportFailure: false,
  });

  const isManaged = server.managedBy === "trumbo-platform";

  const handleToggle = useCallback(async () => {
    setBusy(true);
    try {
      await mcpToggleServer({
        environmentId,
        input: { name: server.name, disabled: !server.disabled },
      });
      onRefresh();
    } catch (error) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not update MCP server",
          description: error instanceof Error ? error.message : "Toggle failed.",
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [environmentId, mcpToggleServer, onRefresh, server.disabled, server.name]);

  const handleDelete = useCallback(async () => {
    setBusy(true);
    try {
      await mcpDeleteServer({ environmentId, input: { name: server.name } });
      onRefresh();
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: "MCP server removed",
          description: server.name,
        }),
      );
    } catch (error) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not delete MCP server",
          description: error instanceof Error ? error.message : "Delete failed.",
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [environmentId, mcpDeleteServer, onRefresh, server.name]);

  const handleOAuth = useCallback(async () => {
    setBusy(true);
    try {
      const result = await mcpStartOAuth({ environmentId, input: { name: server.name } });
      if (result._tag === "Failure") {
        throw squashAtomCommandFailure(result);
      }
      const payload = Option.getOrNull(AsyncResult.value(result));
      if (!payload) {
        throw new Error("OAuth start returned no payload.");
      }
      if (payload.authorizationUrl) {
        await openUrlInBrowser(payload.authorizationUrl);
      }
      toastManager.add(
        stackedThreadToast({
          type: "info",
          title: "OAuth authorization",
          description: payload.message,
        }),
      );
    } catch (error) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "OAuth unavailable",
          description: error instanceof Error ? error.message : "OAuth start failed.",
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [environmentId, mcpStartOAuth, server.name]);

  return (
    <SettingsRow
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{server.name}</span>
          {isManaged ? <Badge variant="secondary">Platform</Badge> : null}
          {server.disabled ? <Badge variant="outline">Disabled</Badge> : null}
        </span>
      }
      description={
        <span className="space-y-1">
          <span className="block font-mono text-[11px] text-muted-foreground/90">
            {server.transportLabel}
          </span>
          <span className="block text-[11px] text-muted-foreground/70">
            Auth: {server.authLabel}
          </span>
          {server.oauthError ? (
            <span className="block text-[11px] text-destructive/80">{server.oauthError}</span>
          ) : null}
        </span>
      }
      control={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {!isManaged && server.transportType !== "stdio" && server.authLabel.includes("oauth") ? (
            <Button
              size="icon-xs"
              variant="ghost"
              disabled={busy}
              onClick={() => void handleOAuth()}
            >
              <KeyRoundIcon className="size-3.5" />
            </Button>
          ) : null}
          {!isManaged ? (
            <>
              <Switch
                checked={!server.disabled}
                disabled={busy}
                onCheckedChange={() => void handleToggle()}
                aria-label={`Toggle ${server.name}`}
              />
              <Button
                size="icon-xs"
                variant="ghost"
                disabled={busy}
                onClick={() => void handleDelete()}
              >
                <Trash2Icon className="size-3.5 text-destructive/80" />
              </Button>
            </>
          ) : null}
        </div>
      }
    />
  );
}

function McpUnavailableOnWeb() {
  return (
    <SettingsPageContainer>
      <SettingsSection title="MCP servers" icon={<PlugIcon className="size-3.5" />}>
        <SettingsRow
          title="Model Context Protocol"
          description="User MCP configuration is managed in the Trumbo desktop app."
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}

export function McpSettingsPanel() {
  const environmentId = usePrimaryEnvironment()?.environmentId ?? null;
  const mcpListQuery = useEnvironmentQuery(
    environmentId === null
      ? null
      : ecosystemEnvironment.mcpListServers({
          environmentId,
          input: {},
        }),
  );

  const refresh = useCallback(() => {
    mcpListQuery.refresh();
  }, [mcpListQuery]);

  const servers = useMemo(() => mcpListQuery.data?.servers ?? [], [mcpListQuery.data?.servers]);
  const settingsPath = mcpListQuery.data?.settingsPath;

  if (!isNativeTrumboDesktop()) {
    return <McpUnavailableOnWeb />;
  }

  if (!environmentId) {
    return (
      <SettingsPageContainer>
        <SettingsSection title="MCP servers" icon={<PlugIcon className="size-3.5" />}>
          <SettingsRow
            title="Connect an environment"
            description="Open a local server environment to edit MCP settings."
          />
        </SettingsSection>
      </SettingsPageContainer>
    );
  }

  return (
    <SettingsPageContainer>
      <SettingsSection
        title="MCP servers"
        icon={<PlugIcon className="size-3.5" />}
        headerAction={
          <div className="flex items-center gap-1">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Refresh MCP servers"
              onClick={refresh}
              disabled={mcpListQuery.isPending}
            >
              <RefreshCwIcon className={cn("size-3.5", mcpListQuery.isPending && "animate-spin")} />
            </Button>
            <McpServerWizardDialog environmentId={environmentId} onSaved={refresh} />
          </div>
        }
      >
        {settingsPath ? (
          <SettingsRow
            title="Settings file"
            description={
              <span className="font-mono text-[11px] break-all text-muted-foreground/80">
                {settingsPath}
              </span>
            }
          />
        ) : null}
        {mcpListQuery.error ? (
          <SettingsRow title="Could not load MCP servers" description={mcpListQuery.error} />
        ) : mcpListQuery.isPending && mcpListQuery.data === null ? (
          <SettingsRow
            title="Loading MCP servers"
            description="Reading ~/.trumbo MCP settings…"
            control={<LoaderIcon className="size-4 animate-spin text-muted-foreground" />}
          />
        ) : servers.length === 0 ? (
          <SettingsRow
            title="No MCP servers configured"
            description="Add stdio, SSE, or streamable HTTP MCP servers. Platform servers are injected automatically when signed in."
          />
        ) : (
          servers.map((server) => (
            <McpServerRow
              key={server.name}
              server={server}
              environmentId={environmentId}
              onRefresh={refresh}
            />
          ))
        )}
      </SettingsSection>
    </SettingsPageContainer>
  );
}
