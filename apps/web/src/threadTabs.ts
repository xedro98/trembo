import type { ThreadRouteTarget } from "./threadRoutes";

export const MAX_OPEN_THREAD_TABS = 20;
export const DRAFT_THREAD_TAB_PREFIX = "draft:";

export type ThreadTabKey = string;

export function draftThreadTabKey(draftId: string): ThreadTabKey {
  return `${DRAFT_THREAD_TAB_PREFIX}${draftId}`;
}

export function isDraftThreadTabKey(key: ThreadTabKey): boolean {
  return key.startsWith(DRAFT_THREAD_TAB_PREFIX);
}

export function parseDraftThreadTabKey(key: ThreadTabKey): string | null {
  if (!isDraftThreadTabKey(key)) {
    return null;
  }
  const draftId = key.slice(DRAFT_THREAD_TAB_PREFIX.length);
  return draftId.length > 0 ? draftId : null;
}

export function threadTabKeyFromRouteTarget(target: ThreadRouteTarget): ThreadTabKey {
  if (target.kind === "draft") {
    return draftThreadTabKey(target.draftId);
  }
  return `${target.threadRef.environmentId}:${target.threadRef.threadId}`;
}

export function openThreadTab(
  openThreadTabKeys: readonly ThreadTabKey[],
  threadKey: ThreadTabKey,
  options?: {
    readonly maxTabs?: number;
    readonly visitedAtById?: Readonly<Record<string, string>>;
  },
): ThreadTabKey[] {
  if (!threadKey) {
    return [...openThreadTabKeys];
  }

  const maxTabs = options?.maxTabs ?? MAX_OPEN_THREAD_TABS;
  const existingIndex = openThreadTabKeys.indexOf(threadKey);
  if (existingIndex >= 0) {
    return [...openThreadTabKeys];
  }

  let next = [...openThreadTabKeys, threadKey];
  if (next.length <= maxTabs) {
    return next;
  }

  const visitedAtById = options?.visitedAtById ?? {};
  while (next.length > maxTabs) {
    let dropIndex = 0;
    let oldestMs = Number.POSITIVE_INFINITY;
    for (let index = 0; index < next.length; index++) {
      const key = next[index]!;
      if (key === threadKey) {
        continue;
      }
      const visitedMs = Date.parse(visitedAtById[key] ?? "");
      const score = Number.isFinite(visitedMs) ? visitedMs : index;
      if (score < oldestMs) {
        oldestMs = score;
        dropIndex = index;
      }
    }
    next = next.filter((_, index) => index !== dropIndex);
  }
  return next;
}

export function closeThreadTab(
  openThreadTabKeys: readonly ThreadTabKey[],
  threadKey: ThreadTabKey,
): ThreadTabKey[] {
  if (!openThreadTabKeys.includes(threadKey)) {
    return [...openThreadTabKeys];
  }
  return openThreadTabKeys.filter((key) => key !== threadKey);
}

export function closeOtherThreadTabs(
  openThreadTabKeys: readonly ThreadTabKey[],
  threadKey: ThreadTabKey,
): ThreadTabKey[] {
  if (!openThreadTabKeys.includes(threadKey)) {
    return [...openThreadTabKeys];
  }
  return [threadKey];
}

export function closeThreadTabsToRight(
  openThreadTabKeys: readonly ThreadTabKey[],
  threadKey: ThreadTabKey,
): ThreadTabKey[] {
  const index = openThreadTabKeys.indexOf(threadKey);
  if (index < 0) {
    return [...openThreadTabKeys];
  }
  return openThreadTabKeys.slice(0, index + 1);
}

export function resolveNeighborThreadTab(
  openThreadTabKeys: readonly ThreadTabKey[],
  closedKey: ThreadTabKey,
): ThreadTabKey | null {
  const index = openThreadTabKeys.indexOf(closedKey);
  if (index < 0) {
    return openThreadTabKeys[0] ?? null;
  }
  if (openThreadTabKeys.length <= 1) {
    return null;
  }
  return openThreadTabKeys[index + 1] ?? openThreadTabKeys[index - 1] ?? null;
}
