// @effect-diagnostics missingEffectContext:off missingEffectError:off unsafeEffectTypeAssertion:off exactOptionalPropertyTypes:off

import { ProviderDriverKind, type ServerProvider, TrumboSettings } from "@trumbo-code/contracts";
import * as Crypto from "effect/Crypto";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import { HttpClient } from "effect/unstable/http";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";

import { ServerConfig } from "../../config.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import { ServerSettingsError } from "@trumbo-code/contracts";
import { makeTrumboTextGeneration } from "../../textGeneration/TrumboTextGeneration.ts";
import * as TrumboPlatformTokenManager from "../../auth/TrumboPlatformTokenManager.ts";
import { ProviderDriverError } from "../Errors.ts";
import type { ProviderMaintenanceCapabilities } from "../providerMaintenance.ts";
import { makeTrumboAdapter } from "../Layers/TrumboAdapter.ts";
import {
  buildInitialTrumboProviderSnapshot,
  checkTrumboProviderStatus,
  enrichTrumboProviderSnapshot,
} from "../Layers/TrumboProvider.ts";
import { ProviderEventLoggers } from "../Layers/ProviderEventLoggers.ts";
import { makeManagedServerProvider } from "../makeManagedServerProvider.ts";
import {
  defaultProviderContinuationIdentity,
  type ProviderDriver,
  type ProviderInstance,
} from "../ProviderDriver.ts";
import type { ServerProviderDraft } from "../providerSnapshot.ts";
import { mergeProviderInstanceEnvironment } from "../ProviderInstanceEnvironment.ts";
import {
  haveProviderSnapshotSettingsChanged,
  makeProviderSnapshotSettingsSource,
  type ProviderSnapshotSettings,
} from "../providerUpdateSettings.ts";

const SNAPSHOT_REFRESH_INTERVAL = Duration.hours(1);
const DRIVER_KIND = ProviderDriverKind.make("trumbo");

export type TrumboDriverEnv =
  | ChildProcessSpawner.ChildProcessSpawner
  | Crypto.Crypto
  | HttpClient.HttpClient
  | ProviderEventLoggers
  | ServerConfig
  | ServerSettingsService
  | Scope.Scope
  | TrumboPlatformTokenManager.TrumboPlatformTokenManager;

const withInstanceIdentity =
  (input: {
    readonly instanceId: ProviderInstance["instanceId"];
    readonly displayName: string | undefined;
    readonly accentColor: string | undefined;
    readonly continuationGroupKey: string;
  }) =>
  (snapshot: ServerProviderDraft): ServerProvider => ({
    ...snapshot,
    instanceId: input.instanceId,
    driver: DRIVER_KIND,
    ...(input.displayName ? { displayName: input.displayName } : {}),
    ...(input.accentColor ? { accentColor: input.accentColor } : {}),
    continuation: { groupKey: input.continuationGroupKey },
  });

const decodeDefaultTrumboSettings = Schema.decodeSync(TrumboSettings);

export const TrumboDriver: ProviderDriver<TrumboSettings, TrumboDriverEnv> = {
  driverKind: DRIVER_KIND,
  metadata: {
    displayName: "Trumbo",
    supportsMultipleInstances: false,
  },
  configSchema: TrumboSettings,
  defaultConfig: (): TrumboSettings => decodeDefaultTrumboSettings({}),
  create: ({ instanceId, displayName, accentColor, environment, enabled, config }) =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;
      const serverConfig = yield* ServerConfig;
      const httpClient = yield* HttpClient.HttpClient;
      const eventLoggers = yield* ProviderEventLoggers;
      const processEnv = mergeProviderInstanceEnvironment(environment);
      const continuationIdentity = defaultProviderContinuationIdentity({
        driverKind: DRIVER_KIND,
        instanceId,
      });
      const stampIdentity = withInstanceIdentity({
        instanceId,
        displayName,
        accentColor,
        continuationGroupKey: continuationIdentity.continuationKey,
      });
      const effectiveConfig = { ...config, enabled: enabled ?? config.enabled ?? true };
      const adapter = yield* makeTrumboAdapter({
        environment: processEnv,
        instanceId,
        ...(effectiveConfig.binaryPath?.trim()
          ? { binaryPath: effectiveConfig.binaryPath.trim() }
          : {}),
        ...(effectiveConfig.cliCwd?.trim() ? { cliCwd: effectiveConfig.cliCwd.trim() } : {}),
        enableAgentTeams: effectiveConfig.enableAgentTeams ?? true,
        enableSpawnAgent: effectiveConfig.enableSpawnAgent ?? true,
        nativeEventLogPath: `${serverConfig.providerLogsDir}/trumbo-native.ndjson`,
        ...(eventLoggers.native ? { nativeEventLogger: eventLoggers.native } : {}),
      });
      const textGeneration = yield* makeTrumboTextGeneration();

      const snapshotSettings = makeProviderSnapshotSettingsSource(effectiveConfig, serverSettings);
      const checkProvider = snapshotSettings.getSettings.pipe(
        Effect.flatMap((settings) =>
          checkTrumboProviderStatus(settings.provider).pipe(Effect.map(stampIdentity)),
        ),
      );
      const snapshot = yield* makeManagedServerProvider<ProviderSnapshotSettings<TrumboSettings>>({
        maintenanceCapabilities: null as unknown as ProviderMaintenanceCapabilities,
        getSettings: snapshotSettings.getSettings,
        streamSettings: snapshotSettings.streamSettings,
        haveSettingsChanged: haveProviderSnapshotSettingsChanged,
        initialSnapshot: (settings) =>
          buildInitialTrumboProviderSnapshot(settings.provider).pipe(
            Effect.map(stampIdentity),
          ) as Effect.Effect<ServerProvider, never, never>,
        checkProvider: checkProvider as Effect.Effect<ServerProvider, ServerSettingsError, never>,
        enrichSnapshot: (({
          settings,
          snapshot,
          publishSnapshot,
        }: {
          readonly settings: ProviderSnapshotSettings<TrumboSettings>;
          readonly snapshot: ServerProvider;
          readonly publishSnapshot: (snapshot: ServerProvider) => Effect.Effect<void>;
        }) =>
          enrichTrumboProviderSnapshot({
            settings: settings.provider,
            snapshot,
            publishSnapshot,
            httpClient,
          })) as unknown as NonNullable<
          Parameters<typeof makeManagedServerProvider>[0]["enrichSnapshot"]
        >,
        refreshInterval: SNAPSHOT_REFRESH_INTERVAL,
      }).pipe(
        Effect.mapError(
          (cause) =>
            new ProviderDriverError({
              driver: DRIVER_KIND,
              instanceId,
              detail: `Failed to build Trumbo snapshot: ${cause.message ?? String(cause)}`,
              cause,
            }),
        ),
      );

      return {
        instanceId,
        driverKind: DRIVER_KIND,
        continuationIdentity,
        displayName,
        accentColor,
        enabled: effectiveConfig.enabled ?? true,
        snapshot,
        adapter,
        textGeneration,
      } as ProviderInstance;
    }) as Effect.Effect<ProviderInstance, ProviderDriverError, TrumboDriverEnv | Scope.Scope>,
};
