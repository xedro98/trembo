// @effect-diagnostics globalFetchInEffect:off

import type { ProviderOptionDescriptor, ServerProviderModel } from "@trumbo-code/contracts";
import { createModelCapabilities } from "@trumbo-code/shared/model";
import * as Effect from "effect/Effect";

const DEFAULT_TRUMBO_API_BASE_URL = "https://api.trumbo.dev";
const RECOMMENDED_MODELS_PATH = "/api/v1/ai/trumbo/recommended-models";

export const QUARTZ_MODEL_SLUGS = ["quartz-1.0", "quartz-1.0-lite", "quartz-1.0-hyper"] as const;

/**
 * Thinking-level options exposed for every Trumbo-routed model. The values
 * match the CLI's `--thinking` levels (none|low|medium|high|xhigh) and are
 * forwarded to the agent process as `TRUMBO_THINKING_LEVEL` at session start.
 * The composer renders this descriptor as the "Thinking level" picker.
 */
export const TRUMBO_THINKING_LEVEL_DESCRIPTOR_ID = "reasoningEffort";

export const TRUMBO_THINKING_LEVEL_OPTIONS = [
  { id: "none", label: "Off" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium", isDefault: true },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra High" },
] as const;

export function createTrumboModelCapabilities() {
  const optionDescriptors: ProviderOptionDescriptor[] = [
    {
      id: TRUMBO_THINKING_LEVEL_DESCRIPTOR_ID,
      label: "Thinking level",
      type: "select",
      options: TRUMBO_THINKING_LEVEL_OPTIONS.map((option) => ({ ...option })),
      currentValue: "medium",
    },
  ];
  return createModelCapabilities({ optionDescriptors });
}

export const QUARTZ_BASELINE_MODELS: ReadonlyArray<ServerProviderModel> = [
  {
    slug: "quartz-1.0",
    name: "Quartz 1.0",
    isCustom: false,
    capabilities: createTrumboModelCapabilities(),
  },
  {
    slug: "quartz-1.0-lite",
    name: "Quartz 1.0 Lite",
    isCustom: false,
    capabilities: createTrumboModelCapabilities(),
  },
  {
    slug: "quartz-1.0-hyper",
    name: "Quartz 1.0 Hyper",
    isCustom: false,
    capabilities: createTrumboModelCapabilities(),
  },
];

interface TrumboCatalogEntry {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
}

export interface TrumboCatalogPayload {
  readonly trumbo?: ReadonlyArray<TrumboCatalogEntry>;
  readonly trumboPass?: ReadonlyArray<TrumboCatalogEntry>;
  readonly recommended?: ReadonlyArray<TrumboCatalogEntry>;
  readonly free?: ReadonlyArray<TrumboCatalogEntry>;
}

export function resolveTrumboApiBaseUrl(): string {
  const fromEnv = process.env.TRUMBO_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/api\/v1\/?$/u, "").replace(/\/+$/u, "");
  }
  return DEFAULT_TRUMBO_API_BASE_URL;
}

function toServerProviderModel(entry: TrumboCatalogEntry): ServerProviderModel {
  return {
    slug: entry.id,
    name: entry.name?.trim() || entry.id,
    isCustom: false,
    capabilities: createTrumboModelCapabilities(),
  };
}

function baselineModelForSlug(slug: string): ServerProviderModel | undefined {
  return QUARTZ_BASELINE_MODELS.find((model) => model.slug === slug);
}

/** Merge the platform catalog into provider models, Quartz first like the CLI picker. */
export function buildTrumboProviderModelsFromCatalog(
  payload: TrumboCatalogPayload | null | undefined,
): ReadonlyArray<ServerProviderModel> {
  if (!payload) {
    return QUARTZ_BASELINE_MODELS;
  }

  const catalogEntries = [
    ...(payload.trumbo ?? []),
    ...(payload.trumboPass ?? []),
    ...(payload.recommended ?? []),
    ...(payload.free ?? []),
  ];
  const byId = new Map<string, TrumboCatalogEntry>();
  for (const entry of catalogEntries) {
    const id = entry.id?.trim();
    if (!id) continue;
    if (!byId.has(id)) {
      byId.set(id, entry);
    }
  }

  const models: ServerProviderModel[] = [];
  const seen = new Set<string>();

  for (const slug of QUARTZ_MODEL_SLUGS) {
    const catalogEntry = byId.get(slug);
    models.push(
      catalogEntry
        ? toServerProviderModel(catalogEntry)
        : (baselineModelForSlug(slug) as ServerProviderModel),
    );
    seen.add(slug);
  }

  for (const entry of catalogEntries) {
    const id = entry.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push(toServerProviderModel(entry));
  }

  return models.length > 0 ? models : QUARTZ_BASELINE_MODELS;
}

export const fetchTrumboRecommendedCatalog = Effect.fn("fetchTrumboRecommendedCatalog")(
  function* () {
    const url = `${resolveTrumboApiBaseUrl()}${RECOMMENDED_MODELS_PATH}`;
    return yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as TrumboCatalogPayload;
      },
      catch: () => null,
    });
  },
);
