import type * as EffectAcpSchema from "effect-acp/schema";

import type { McpProviderSessionConfig } from "../../mcp/McpProviderSession.ts";

export const TRUMBO_PLATFORM_MCP_SERVER_NAME = "trumbo-platform";
export const TRUMBO_CODE_PREVIEW_MCP_SERVER_NAME = "trumbo-code";
export const DEFAULT_TRUMBO_PLATFORM_MCP_URL = "https://api.trumbo.dev/v1/mcp";

export function buildTrumboPlatformMcpServer(
  accessToken: string,
  mcpBaseUrl: string = DEFAULT_TRUMBO_PLATFORM_MCP_URL,
): EffectAcpSchema.McpServer {
  return {
    type: "http",
    name: TRUMBO_PLATFORM_MCP_SERVER_NAME,
    url: mcpBaseUrl,
    headers: [
      {
        name: "Authorization",
        value: `Bearer ${accessToken}`,
      },
    ],
  };
}

export function buildTrumboCodePreviewMcpServer(
  session: McpProviderSessionConfig,
): EffectAcpSchema.McpServer {
  return {
    type: "http",
    name: TRUMBO_CODE_PREVIEW_MCP_SERVER_NAME,
    url: session.endpoint,
    headers: [
      {
        name: "Authorization",
        value: session.authorizationHeader,
      },
    ],
  };
}

export function buildTrumboAcpMcpServers(input: {
  readonly accessToken: string;
  readonly previewSession?: McpProviderSessionConfig;
  readonly mcpBaseUrl?: string;
}): ReadonlyArray<EffectAcpSchema.McpServer> {
  const servers: Array<EffectAcpSchema.McpServer> = [
    buildTrumboPlatformMcpServer(input.accessToken, input.mcpBaseUrl),
  ];
  if (input.previewSession) {
    servers.push(buildTrumboCodePreviewMcpServer(input.previewSession));
  }
  return servers;
}
