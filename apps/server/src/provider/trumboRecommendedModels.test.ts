import { describe, expect, it } from "vitest";
import {
  buildTrumboProviderModelsFromCatalog,
  QUARTZ_BASELINE_MODELS,
  QUARTZ_MODEL_SLUGS,
  TRUMBO_THINKING_LEVEL_DESCRIPTOR_ID,
  TRUMBO_THINKING_LEVEL_OPTIONS,
} from "./trumboRecommendedModels.ts";

describe("buildTrumboProviderModelsFromCatalog", () => {
  it("returns Quartz baseline models when catalog is unavailable", () => {
    expect(buildTrumboProviderModelsFromCatalog(null).map((model) => model.slug)).toEqual([
      ...QUARTZ_MODEL_SLUGS,
    ]);
  });

  it("lists Quartz first then the rest of the subscription catalog", () => {
    const models = buildTrumboProviderModelsFromCatalog({
      trumbo: [
        { id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
        { id: "quartz-1.0-hyper", name: "Quartz 1.0 Hyper" },
        { id: "quartz-1.0-lite", name: "Quartz 1.0 Lite" },
        { id: "quartz-1.0", name: "Quartz 1.0" },
      ],
      trumboPass: [{ id: "openai/gpt-5.3-codex", name: "GPT-5.3 Codex" }],
    });

    expect(models.slice(0, 3).map((model) => model.slug)).toEqual([...QUARTZ_MODEL_SLUGS]);
    expect(models.map((model) => model.slug)).toEqual([
      "quartz-1.0",
      "quartz-1.0-lite",
      "quartz-1.0-hyper",
      "anthropic/claude-sonnet-4.6",
      "openai/gpt-5.3-codex",
    ]);
  });

  it("exposes a thinking-level descriptor on every baseline and catalog model", () => {
    const models = [
      ...QUARTZ_BASELINE_MODELS,
      ...buildTrumboProviderModelsFromCatalog({
        trumbo: [{ id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6" }],
      }),
    ];

    for (const model of models) {
      const descriptor = model.capabilities?.optionDescriptors?.find(
        (candidate) => candidate.id === TRUMBO_THINKING_LEVEL_DESCRIPTOR_ID,
      );
      expect(descriptor, `thinking-level descriptor for ${model.slug}`).toBeDefined();
      expect(descriptor?.type).toBe("select");
      if (descriptor?.type === "select") {
        expect(descriptor.options.map((option) => option.id)).toEqual(
          TRUMBO_THINKING_LEVEL_OPTIONS.map((option) => option.id),
        );
        expect(descriptor.currentValue).toBe("medium");
      }
    }
  });
});
