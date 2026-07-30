import { describe, expect, it } from "vitest";

import { modelLabLogoUrl, resolveModelLabId } from "../../lib/modelLabLogo";

describe("resolveModelLabId", () => {
  it("maps quartz models to trumbo", () => {
    expect(resolveModelLabId("quartz-1.0-hyper", "Quartz Hyper")).toBe("trumbo");
  });

  it("maps deepseek and qwen families", () => {
    expect(resolveModelLabId("deepseek-v3", "DeepSeek V3")).toBe("deepseek");
    expect(resolveModelLabId("qwen2p5-72b-instruct", "Qwen2.5 72B Instruct")).toBe("alibaba");
  });

  it("uses slash prefix when present", () => {
    expect(resolveModelLabId("meta-llama/llama-3-70b", "Llama 3 70B")).toBe("meta");
  });

  it("resolves namespaced trumbo catalog ids to the underlying lab", () => {
    expect(resolveModelLabId("trumbo/claude-sonnet-4-6", "Claude Sonnet 4.6")).toBe("anthropic");
    expect(resolveModelLabId("trumbo/gpt-5.4", "GPT-5.4")).toBe("openai");
  });

  it("maps gemini models to google", () => {
    expect(resolveModelLabId("gemini-2.5-pro", "Gemini 2.5 Pro")).toBe("google");
  });
});

describe("modelLabLogoUrl", () => {
  it("uses the local trumbo mark for quartz", () => {
    expect(modelLabLogoUrl("trumbo")).toBe("/trumbo-logo.svg");
  });
});
