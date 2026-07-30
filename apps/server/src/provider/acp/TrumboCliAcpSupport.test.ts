import { describe, expect, it } from "vitest";

import { buildTrumboApiEnv } from "./TrumboCliAcpSupport.ts";

describe("buildTrumboApiEnv", () => {
  it("defaults team and spawn flags to enabled when unset", () => {
    const env = buildTrumboApiEnv(undefined, "token", "quartz-1.0");
    expect(env.TRUMBO_ENABLE_AGENT_TEAMS).toBe("1");
    expect(env.TRUMBO_ENABLE_SPAWN_AGENT).toBe("1");
  });

  it("honors explicit disable flags", () => {
    const env = buildTrumboApiEnv(undefined, "token", "quartz-1.0", undefined, {
      enableAgentTeams: false,
      enableSpawnAgent: false,
    });
    expect(env.TRUMBO_ENABLE_AGENT_TEAMS).toBe("0");
    expect(env.TRUMBO_ENABLE_SPAWN_AGENT).toBe("0");
  });

  it("forwards the thinking level when provided", () => {
    const env = buildTrumboApiEnv(undefined, "token", "quartz-1.0", undefined, undefined, "high");
    expect(env.TRUMBO_THINKING_LEVEL).toBe("high");
  });

  it("omits the thinking level when unset or blank", () => {
    const unset = buildTrumboApiEnv(undefined, "token", "quartz-1.0");
    expect(unset.TRUMBO_THINKING_LEVEL).toBeUndefined();
    const blank = buildTrumboApiEnv(undefined, "token", "quartz-1.0", undefined, undefined, "  ");
    expect(blank.TRUMBO_THINKING_LEVEL).toBeUndefined();
  });
});
