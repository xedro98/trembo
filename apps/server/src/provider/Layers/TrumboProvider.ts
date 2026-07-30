// @effect-diagnostics missingEffectError:off exactOptionalPropertyTypes:off

import {
  ProviderDriverKind,
  type ServerProvider,
  type ServerProviderModel,
  type TrumboSettings,
} from "@trumbo-code/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { HttpClient } from "effect/unstable/http";

import * as TrumboPlatformTokenManager from "../../auth/TrumboPlatformTokenManager.ts";
import {
  hasActiveTrumboModelSubscription,
  readTrumboPlatformSubscription,
  TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE,
  TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE,
} from "../../auth/trumboSubscriptionAccess.ts";
import { buildServerProvider, type ServerProviderDraft } from "../providerSnapshot.ts";
import {
  buildTrumboProviderModelsFromCatalog,
  fetchTrumboRecommendedCatalog,
  QUARTZ_BASELINE_MODELS,
  type TrumboCatalogPayload,
} from "../trumboRecommendedModels.ts";

const TRUMBO_PRESENTATION = {
  displayName: "Trumbo",
  showInteractionModeToggle: true,
  requiresNewThreadForModelChange: false,
} as const;

export function resolveTrumboProviderModels(
  settings: TrumboSettings,
  catalog: TrumboCatalogPayload | null | undefined,
): ReadonlyArray<ServerProviderModel> {
  const baseline = buildTrumboProviderModelsFromCatalog(catalog);
  const customModels = settings.customModels ?? [];
  if (customModels.length === 0) {
    return baseline;
  }

  const seen = new Set(baseline.map((model) => model.slug));
  const models = [...baseline];
  for (const slug of customModels) {
    const normalized = slug.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    models.push({
      slug: normalized,
      name: normalized,
      isCustom: true,
      capabilities: baseline[0]?.capabilities ?? QUARTZ_BASELINE_MODELS[0]!.capabilities,
    });
  }
  return models;
}

/** @deprecated Use resolveTrumboProviderModels(settings, catalog). */
export function buildTrumboProviderModels(
  settings: TrumboSettings,
): ReadonlyArray<ServerProviderModel> {
  return resolveTrumboProviderModels(settings, null);
}

function buildTrumboSnapshotDraft(input: {
  readonly settings: TrumboSettings;
  readonly models: ReadonlyArray<ServerProviderModel>;
  readonly checkedAt: string;
  readonly hasCredential: boolean;
  readonly hasActiveSubscription: boolean;
}): ServerProviderDraft {
  if (!input.settings.enabled) {
    return buildServerProvider({
      presentation: TRUMBO_PRESENTATION,
      enabled: false,
      checkedAt: input.checkedAt,
      models: input.models,
      probe: {
        installed: true,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Trumbo is disabled in settings.",
      },
    });
  }

  if (!input.hasCredential) {
    return buildServerProvider({
      presentation: TRUMBO_PRESENTATION,
      enabled: true,
      checkedAt: input.checkedAt,
      models: [],
      probe: {
        installed: true,
        version: "1.0",
        status: "warning",
        auth: { status: "unauthenticated" },
        message: TRUMBO_SIGN_IN_FOR_MODELS_MESSAGE,
      },
    });
  }

  if (!input.hasActiveSubscription) {
    return buildServerProvider({
      presentation: TRUMBO_PRESENTATION,
      enabled: true,
      checkedAt: input.checkedAt,
      models: [],
      probe: {
        installed: true,
        version: "1.0",
        status: "warning",
        auth: { status: "authenticated" },
        message: TRUMBO_SUBSCRIBE_FOR_MODELS_MESSAGE,
      },
    });
  }

  return buildServerProvider({
    presentation: TRUMBO_PRESENTATION,
    enabled: true,
    checkedAt: input.checkedAt,
    models: input.models,
    probe: {
      installed: true,
      version: "1.0",
      status: "ready",
      auth: { status: "authenticated" },
      message:
        input.models.length > QUARTZ_BASELINE_MODELS.length
          ? `Loaded ${input.models.length} Trumbo subscription models.`
          : "Trumbo subscription models are available.",
    },
  });
}

export function buildInitialTrumboProviderSnapshot(
  settings: TrumboSettings,
): Effect.Effect<
  ServerProviderDraft,
  never,
  TrumboPlatformTokenManager.TrumboPlatformTokenManager
> {
  return Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const tokens = yield* TrumboPlatformTokenManager.TrumboPlatformTokenManager;
    const hasCredential = yield* tokens.hasCredential;
    const subscription = hasCredential ? yield* readTrumboPlatformSubscription : null;
    return buildTrumboSnapshotDraft({
      settings,
      models: resolveTrumboProviderModels(settings, null),
      checkedAt,
      hasCredential,
      hasActiveSubscription: hasActiveTrumboModelSubscription(subscription),
    });
  });
}

export function checkTrumboProviderStatus(
  settings: TrumboSettings,
): Effect.Effect<
  ServerProviderDraft,
  never,
  TrumboPlatformTokenManager.TrumboPlatformTokenManager
> {
  return buildInitialTrumboProviderSnapshot(settings);
}

export const enrichTrumboProviderSnapshot = (input: {
  readonly settings: TrumboSettings;
  readonly snapshot: ServerProvider;
  readonly publishSnapshot: (snapshot: ServerProvider) => Effect.Effect<void>;
  readonly httpClient: HttpClient.HttpClient;
}): Effect.Effect<void, never, TrumboPlatformTokenManager.TrumboPlatformTokenManager> =>
  Effect.gen(function* () {
    const catalog = yield* fetchTrumboRecommendedCatalog();
    const mergedModels = resolveTrumboProviderModels(input.settings, catalog);
    const tokens = yield* TrumboPlatformTokenManager.TrumboPlatformTokenManager;
    const hasCredential = yield* tokens.hasCredential;
    const subscription = hasCredential ? yield* readTrumboPlatformSubscription : null;
    const hasActiveSubscription = hasActiveTrumboModelSubscription(subscription);
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const draft = buildTrumboSnapshotDraft({
      settings: input.settings,
      models: mergedModels,
      checkedAt,
      hasCredential,
      hasActiveSubscription,
    });

    const nextSnapshot: ServerProvider = {
      ...input.snapshot,
      enabled: draft.enabled,
      installed: draft.installed,
      version: draft.version,
      status: draft.status,
      auth: draft.auth,
      checkedAt: draft.checkedAt,
      models: draft.models,
      ...(draft.message ? { message: draft.message } : {}),
    };

    if (
      nextSnapshot.models.length === input.snapshot.models.length &&
      nextSnapshot.auth.status === input.snapshot.auth.status &&
      nextSnapshot.status === input.snapshot.status &&
      nextSnapshot.message === input.snapshot.message &&
      nextSnapshot.models.every(
        (model, index) =>
          input.snapshot.models[index]?.slug === model.slug &&
          input.snapshot.models[index]?.name === model.name,
      )
    ) {
      return;
    }

    yield* input.publishSnapshot(nextSnapshot);
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning("Trumbo model catalog enrichment failed", {
        error: cause,
      }),
    ),
    Effect.asVoid,
  );

export const TRUMBO_DRIVER_KIND = ProviderDriverKind.make("trumbo");
