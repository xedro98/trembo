// @effect-diagnostics nodeBuiltinImport:off

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import {
  PlatformEcosystemError,
  type McpServerSummary,
  type McpServerUpsertInput,
} from "@trumbo-code/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as TrumboPlatformTokenManager from "../auth/TrumboPlatformTokenManager.ts";
import { hasStaticMcpAuthorization, syncManagedPlatformMcpSettings } from "./platformMcpSync.ts";
import { resolveDefaultMcpSettingsPath } from "./trumboCliRunner.ts";

type McpTransport =
  | { type: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
  | { type: "sse"; url: string; headers?: Record<string, string> }
  | { type: "streamableHttp"; url: string; headers?: Record<string, string> };

interface StoredMcpServer {
  transport?: McpTransport;
  disabled?: boolean;
  oauth?: {
    tokens?: { access_token?: string };
    lastError?: string;
  };
  metadata?: {
    managedBy?: string;
  };
  command?: string;
  url?: string;
  headers?: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTransport(entry: StoredMcpServer): McpTransport {
  if (entry.transport) {
    return entry.transport;
  }
  if (typeof entry.command === "string" && entry.command.trim()) {
    return { type: "stdio", command: entry.command.trim() };
  }
  if (typeof entry.url === "string" && entry.url.trim()) {
    return {
      type: "streamableHttp",
      url: entry.url.trim(),
      ...(entry.headers ? { headers: entry.headers } : {}),
    };
  }
  return { type: "stdio", command: "unknown" };
}

function transportLabel(transport: McpTransport): string {
  if (transport.type === "stdio") {
    return `stdio: ${transport.command}`;
  }
  return `${transport.type}: ${transport.url}`;
}

function authLabel(entry: StoredMcpServer, transport: McpTransport): string {
  if (transport.type === "stdio") return "local";
  if (transport.headers && hasStaticMcpAuthorization(transport.headers)) {
    return "authorized";
  }
  if (entry.oauth?.lastError) return "oauth error";
  const token = entry.oauth?.tokens?.access_token;
  if (typeof token === "string" && token.trim()) return "oauth authorized";
  if (entry.oauth && Object.keys(entry.oauth).length > 0) return "oauth pending";
  if (transport.headers && Object.keys(transport.headers).length > 0) return "static headers";
  return "no auth";
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

function toSummary(name: string, entry: StoredMcpServer): McpServerSummary {
  const transport = normalizeTransport(entry);
  const staticAuth = transport.type !== "stdio" && hasStaticMcpAuthorization(transport.headers);
  return {
    name,
    transportType: transport.type === "streamableHttp" ? "streamableHttp" : transport.type,
    transportLabel: transportLabel(transport),
    disabled: entry.disabled === true,
    authLabel: authLabel(entry, transport),
    ...(entry.metadata?.managedBy ? { managedBy: entry.metadata.managedBy } : {}),
    ...(entry.oauth?.lastError && !staticAuth ? { oauthError: entry.oauth.lastError } : {}),
  };
}

function buildTransport(input: McpServerUpsertInput): McpTransport {
  if (input.transportType === "stdio") {
    const command = input.command?.trim();
    if (!command) {
      throw new PlatformEcosystemError({
        operation: "mcp.upsert",
        message: "stdio MCP servers require a command.",
      });
    }
    return {
      type: "stdio",
      command,
      ...(input.args?.length ? { args: [...input.args] } : {}),
      ...(input.env && Object.keys(input.env).length > 0 ? { env: { ...input.env } } : {}),
    };
  }
  const url = input.url?.trim();
  if (!url) {
    throw new PlatformEcosystemError({
      operation: "mcp.upsert",
      message: "Remote MCP servers require a URL.",
    });
  }
  const headers =
    input.authMode === "headers" && input.headers ? { ...input.headers } : input.headers;
  if (input.transportType === "sse") {
    return {
      type: "sse",
      url,
      ...(headers && Object.keys(headers).length > 0 ? { headers } : {}),
    };
  }
  return {
    type: "streamableHttp",
    url,
    ...(headers && Object.keys(headers).length > 0 ? { headers } : {}),
  };
}

export const makeMcpSettingsService = () => {
  const settingsPath = resolveDefaultMcpSettingsPath();

  const listServers = Effect.gen(function* () {
    const tokenManager = yield* TrumboPlatformTokenManager.TrumboPlatformTokenManager;
    const accessToken = yield* tokenManager.getAccessToken;
    if (Option.isSome(accessToken)) {
      syncManagedPlatformMcpSettings(accessToken.value, settingsPath);
    }

    const servers = readSettingsFile(settingsPath);
    return {
      settingsPath,
      servers: Object.entries(servers).map(([name, entry]) => toSummary(name, entry)),
    };
  });

  const mutateAndList = (mutator: (servers: Record<string, StoredMcpServer>) => void) =>
    Effect.gen(function* () {
      const servers = readSettingsFile(settingsPath);
      mutator(servers);
      writeSettingsFile(settingsPath, servers);
      return yield* listServers;
    });

  return {
    listServers,
    upsertServer: (input: McpServerUpsertInput) =>
      Effect.try({
        try: () => buildTransport(input),
        catch: (cause) =>
          Schema.is(PlatformEcosystemError)(cause)
            ? cause
            : new PlatformEcosystemError({
                operation: "mcp.upsert",
                message:
                  typeof cause === "object" && cause !== null && "message" in cause
                    ? String((cause as { message: unknown }).message)
                    : String(cause),
              }),
      }).pipe(
        Effect.flatMap((transport) =>
          mutateAndList((servers) => {
            const existing = servers[input.name] ?? {};
            servers[input.name] = {
              ...existing,
              transport,
              ...(existing.disabled !== undefined ? { disabled: existing.disabled } : {}),
              ...(input.authMode === "oauth"
                ? { oauth: existing.oauth ?? {} }
                : input.authMode === "none"
                  ? {}
                  : {}),
              metadata: {
                ...(isRecord(existing.metadata) ? existing.metadata : {}),
                managedBy: "trumbo-code",
              },
            };
          }),
        ),
      ),

    toggleServer: (name: string, disabled: boolean) =>
      mutateAndList((servers) => {
        const existing = servers[name];
        if (!existing) {
          throw new PlatformEcosystemError({
            operation: "mcp.toggle",
            message: `MCP server "${name}" was not found.`,
          });
        }
        if (existing.metadata?.managedBy === "trumbo-platform") {
          throw new PlatformEcosystemError({
            operation: "mcp.toggle",
            message: `Cannot toggle managed platform server "${name}".`,
          });
        }
        servers[name] = { ...existing, disabled };
      }).pipe(
        Effect.catch((cause) =>
          Schema.is(PlatformEcosystemError)(cause)
            ? Effect.fail(cause)
            : Effect.fail(
                new PlatformEcosystemError({
                  operation: "mcp.toggle",
                  message:
                    typeof cause === "object" && cause !== null && "message" in cause
                      ? String((cause as { message: unknown }).message)
                      : String(cause),
                }),
              ),
        ),
      ),

    deleteServer: (name: string) =>
      mutateAndList((servers) => {
        const existing = servers[name];
        if (!existing) {
          throw new PlatformEcosystemError({
            operation: "mcp.delete",
            message: `MCP server "${name}" was not found.`,
          });
        }
        if (existing.metadata?.managedBy === "trumbo-platform") {
          throw new PlatformEcosystemError({
            operation: "mcp.delete",
            message: `Cannot delete managed platform server "${name}".`,
          });
        }
        delete servers[name];
      }).pipe(
        Effect.catch((cause) =>
          Schema.is(PlatformEcosystemError)(cause)
            ? Effect.fail(cause)
            : Effect.fail(
                new PlatformEcosystemError({
                  operation: "mcp.delete",
                  message:
                    typeof cause === "object" && cause !== null && "message" in cause
                      ? String((cause as { message: unknown }).message)
                      : String(cause),
                }),
              ),
        ),
      ),

    startOAuth: (name: string) =>
      Effect.gen(function* () {
        const servers = readSettingsFile(settingsPath);
        const entry = servers[name];
        if (!entry) {
          return yield* Effect.fail(
            new PlatformEcosystemError({
              operation: "mcp.oauth",
              message: `MCP server "${name}" was not found.`,
            }),
          );
        }
        const transport = normalizeTransport(entry);
        if (transport.type === "stdio") {
          return yield* Effect.fail(
            new PlatformEcosystemError({
              operation: "mcp.oauth",
              message: "OAuth is only available for remote MCP servers.",
            }),
          );
        }
        return {
          message:
            "Run `trumbo mcp` in a terminal to complete OAuth for this server, or use the Authorize action after installing Trumbo CLI 0.0.59+.",
        };
      }),
  };
};

export type McpSettingsService = ReturnType<typeof makeMcpSettingsService>;
