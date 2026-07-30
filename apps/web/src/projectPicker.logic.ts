import {
  scopeProjectRef,
  scopedProjectKey,
  scopedThreadKey,
} from "@trumbo-code/client-runtime/environment";
import type { ScopedThreadRef } from "@trumbo-code/contracts";
import type { EnvironmentId, ProjectId, ThreadId } from "@trumbo-code/contracts";

import type { SidebarProjectSnapshot } from "./sidebarProjectGrouping";

export interface ProjectPickerThreadSummary {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  id: ThreadId;
  updatedAt: string;
  archivedAt: string | null;
}

export function resolveActiveProjectGroupKey(input: {
  routeThreadRef: ScopedThreadRef | null;
  draftLogicalProjectKey: string | null;
  threadByKey: ReadonlyMap<string, ProjectPickerThreadSummary>;
  physicalToLogicalKey: ReadonlyMap<string, string>;
  projectPhysicalKeyByScopedRef: ReadonlyMap<string, string>;
}): string | null {
  if (input.draftLogicalProjectKey) {
    return input.draftLogicalProjectKey;
  }
  if (!input.routeThreadRef) {
    return null;
  }

  const activeThread = input.threadByKey.get(scopedThreadKey(input.routeThreadRef));
  if (!activeThread) {
    return null;
  }

  const projectRef = scopeProjectRef(activeThread.environmentId, activeThread.projectId);
  const scopedKey = scopedProjectKey(projectRef);
  const physicalKey = input.projectPhysicalKeyByScopedRef.get(scopedKey) ?? scopedKey;
  return input.physicalToLogicalKey.get(physicalKey) ?? physicalKey;
}

export function countActiveThreadsForProjectGroup(
  project: SidebarProjectSnapshot,
  threads: ReadonlyArray<ProjectPickerThreadSummary>,
): number {
  const memberKeys = new Set(project.memberProjectRefs.map((ref) => scopedProjectKey(ref)));
  let count = 0;
  for (const thread of threads) {
    if (thread.archivedAt !== null) {
      continue;
    }
    const threadProjectKey = scopedProjectKey(
      scopeProjectRef(thread.environmentId, thread.projectId),
    );
    if (memberKeys.has(threadProjectKey)) {
      count++;
    }
  }
  return count;
}

export function mostRecentThreadForProjectGroup(
  project: SidebarProjectSnapshot,
  threads: ReadonlyArray<ProjectPickerThreadSummary>,
): ProjectPickerThreadSummary | null {
  const memberKeys = new Set(project.memberProjectRefs.map((ref) => scopedProjectKey(ref)));
  let best: ProjectPickerThreadSummary | null = null;
  for (const thread of threads) {
    if (thread.archivedAt !== null) {
      continue;
    }
    const threadProjectKey = scopedProjectKey(
      scopeProjectRef(thread.environmentId, thread.projectId),
    );
    if (!memberKeys.has(threadProjectKey)) {
      continue;
    }
    if (!best || thread.updatedAt > best.updatedAt) {
      best = thread;
    }
  }
  return best;
}

export function formatProjectPickerPath(workspaceRoot: string, maxLength = 44): string {
  const normalized = workspaceRoot.replace(/\\/g, "/");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const tail = normalized.slice(-(maxLength - 1));
  const slashIndex = tail.indexOf("/");
  if (slashIndex > 0) {
    return `…${tail.slice(slashIndex)}`;
  }
  return `…${tail}`;
}

export function describeProjectEnvironmentSummary(project: SidebarProjectSnapshot): string {
  if (project.environmentPresence === "local-only") {
    return "Local";
  }
  if (project.environmentPresence === "remote-only") {
    if (project.allRemoteMembersAreDesktopLocal) {
      return project.remoteEnvironmentLabels[0] ?? "Local sandbox";
    }
    return project.remoteEnvironmentLabels.join(", ") || "Remote";
  }
  return "Mixed environments";
}

export function formatThreadCountLabel(count: number): string {
  if (count === 0) {
    return "No threads";
  }
  if (count === 1) {
    return "1 thread";
  }
  return `${count} threads`;
}
