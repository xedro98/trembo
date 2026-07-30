import { useAtomValue } from "@effect/atom-react";
import {
  createManagedRelayQueryManager,
  ManagedRelay,
  managedRelaySessionAtom,
  readManagedRelaySnapshotState,
} from "@trumbo-code/client-runtime/relay";
import type {
  RelayClientDeviceRecord,
  RelayClientEnvironmentRecord,
} from "@trumbo-code/contracts/relay";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useCallback, useEffect } from "react";

import { isNativeTrumboDesktop } from "../lib/nativeTrumboDesktop";
import { runtime } from "../lib/runtime";
import { appAtomRegistry } from "../rpc/atomRegistry";

const managedRelayAtomRuntime = Atom.runtime(
  Layer.effect(
    ManagedRelay.ManagedRelayClient,
    runtime.contextEffect.pipe(
      Effect.map((context) => Context.get(context, ManagedRelay.ManagedRelayClient)),
    ),
  ),
);

export const managedRelayQueryManager = createManagedRelayQueryManager(managedRelayAtomRuntime);

const EMPTY_ENVIRONMENTS_ATOM = Atom.make(
  AsyncResult.success<ReadonlyArray<RelayClientEnvironmentRecord>>([]),
).pipe(Atom.keepAlive, Atom.withLabel("managed-relay:web:environments:null"));

const EMPTY_DEVICES_ATOM = Atom.make(
  AsyncResult.success<ReadonlyArray<RelayClientDeviceRecord>>([]),
).pipe(Atom.keepAlive, Atom.withLabel("managed-relay:web:devices:null"));

const EMPTY_MANAGED_RELAY_SNAPSHOT = {
  data: [] as const,
  error: null,
  isPending: false,
  errorTraceId: null,
};

export function useManagedRelayEnvironments() {
  const nativeDesktop = isNativeTrumboDesktop();
  const session = useAtomValue(managedRelaySessionAtom);
  const accountId = nativeDesktop ? null : (session?.accountId ?? null);
  const atom = accountId
    ? managedRelayQueryManager.environmentsAtom(accountId)
    : EMPTY_ENVIRONMENTS_ATOM;
  const result = useAtomValue(atom);
  const snapshot = readManagedRelaySnapshotState(result);
  useEffect(() => {
    if (nativeDesktop || !snapshot.error) {
      return;
    }
    console.error("[t3-cloud] Relay environment listing failed", {
      message: snapshot.error,
      traceId: snapshot.errorTraceId,
    });
  }, [nativeDesktop, snapshot.error, snapshot.errorTraceId]);
  const refresh = useCallback(() => {
    if (nativeDesktop || !accountId) {
      return;
    }
    managedRelayQueryManager.refreshEnvironments(appAtomRegistry, accountId);
  }, [accountId, nativeDesktop]);

  if (nativeDesktop) {
    return {
      ...EMPTY_MANAGED_RELAY_SNAPSHOT,
      data: [] as ReadonlyArray<RelayClientEnvironmentRecord>,
      accountId: null,
      refresh,
    };
  }

  return {
    ...snapshot,
    accountId,
    refresh,
  };
}

export function useManagedRelayDevices() {
  const nativeDesktop = isNativeTrumboDesktop();
  const session = useAtomValue(managedRelaySessionAtom);
  const accountId = nativeDesktop ? null : (session?.accountId ?? null);
  const atom = accountId ? managedRelayQueryManager.devicesAtom(accountId) : EMPTY_DEVICES_ATOM;
  const result = useAtomValue(atom);
  const snapshot = readManagedRelaySnapshotState(result);
  useEffect(() => {
    if (nativeDesktop || !snapshot.error) {
      return;
    }
    console.error("[t3-cloud] Relay device listing failed", {
      message: snapshot.error,
      traceId: snapshot.errorTraceId,
    });
  }, [nativeDesktop, snapshot.error, snapshot.errorTraceId]);
  const refresh = useCallback(() => {
    if (nativeDesktop || !accountId) {
      return;
    }
    managedRelayQueryManager.refreshDevices(appAtomRegistry, accountId);
  }, [accountId, nativeDesktop]);

  if (nativeDesktop) {
    return {
      ...EMPTY_MANAGED_RELAY_SNAPSHOT,
      data: [] as ReadonlyArray<RelayClientDeviceRecord>,
      accountId: null,
      refresh,
    };
  }

  return {
    ...snapshot,
    accountId,
    refresh,
  };
}

export function refreshManagedRelayEnvironments(): void {
  const session = appAtomRegistry.get(managedRelaySessionAtom);
  if (session) {
    managedRelayQueryManager.refreshEnvironments(appAtomRegistry, session.accountId);
  }
}
