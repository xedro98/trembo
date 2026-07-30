// @effect-diagnostics nodeBuiltinImport:off

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { DEFAULT_TRUMBO_PLATFORM_MCP_URL } from "../provider/acp/trumboAcpMcpServers.ts";
import { resolveTrumboApiBaseUrl } from "../provider/trumboRecommendedModels.ts";
import { resolveDefaultMcpSettingsPath } from "./trumboCliRunner.ts";

export const TRUMBO_PLATFORM_MCP_MANAGED_BY = "trumbo-platform";

interface StoredMcpTransport {
  type: "stdio" | "sse" | "streamableHttp";
  url?: string;
  headers?: Record<string, string>;
}

interface StoredMcpServer {
  transport?: StoredMcpTransport;
  disabled?: boolean;
  oauth?: Record<string, unknown>;
  metadata?: {
    managedBy?: string;
  };
}

function readSettingsFile(filePath: string): Record<string, StoredMcpServer> {
  if (!NodeFS.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = NodeFS.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as { mcpServers?: Record<string, StoredMcpServer> };
    return parsed.mcpServers ?? {};
  } catch {
    return {};
  }
}

function writeSettingsFile(filePath: string, servers: Record<string, StoredMcpServer>): void {
  NodeFS.mkdirSync(NodePath.dirname(filePath), { recursive: true });
  NodeFS.writeFileSync(filePath, `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`, "utf8");
}

export function resolvePlatformMcpUrl(): string {
  const configured = process.env.TRUMBO_PLATFORM_MCP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return `${resolveTrumboApiBaseUrl()}/v1/mcp`;
}

export function buildManagedPlatformMcpServer(accessToken: string): StoredMcpServer {
  return {
    transport: {
      type: "streamableHttp",
      url: resolvePlatformMcpUrl() || DEFAULT_TRUMBO_PLATFORM_MCP_URL,
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    },
    metadata: {
      managedBy: TRUMBO_PLATFORM_MCP_MANAGED_BY,
    },
  };
}

export function hasStaticMcpAuthorization(headers: Record<string, string> | undefined): boolean {
  if (!headers) {
    return false;
  }
  const authorization = headers.Authorization ?? headers.authorization;
  return typeof authorization === "string" && authorization.trim().length > 0;
}

export function syncManagedPlatformMcpSettings(
  accessToken: string,
  settingsPath: string = resolveDefaultMcpSettingsPath(),
): boolean {
  const token = accessToken.trim();
  if (!token) {
    return false;
  }

  const servers = readSettingsFile(settingsPath);
  const existing = servers["trumbo-platform"];
  if (
    existing?.metadata?.managedBy &&
    existing.metadata.managedBy !== TRUMBO_PLATFORM_MCP_MANAGED_BY
  ) {
    return false;
  }

  const desired = buildManagedPlatformMcpServer(token);
  const nextEntry: StoredMcpServer = {
    ...desired,
    ...(existing?.disabled !== undefined ? { disabled: existing.disabled } : {}),
  };

  const unchanged =
    existing &&
    existing.transport?.url === nextEntry.transport?.url &&
    existing.transport?.headers?.Authorization === nextEntry.transport?.headers?.Authorization &&
    existing.metadata?.managedBy === TRUMBO_PLATFORM_MCP_MANAGED_BY &&
    existing.oauth === undefined;

  if (unchanged) {
    return false;
  }

  servers["trumbo-platform"] = nextEntry;
  writeSettingsFile(settingsPath, servers);
  return true;
}
