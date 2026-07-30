import type { ThreadTabKey } from "./threadTabs";

export type ThreadTabGroupColorId =
  | "grey"
  | "blue"
  | "red"
  | "yellow"
  | "green"
  | "pink"
  | "purple"
  | "cyan"
  | "orange";

export interface ThreadTabGroupColor {
  readonly id: ThreadTabGroupColorId;
  readonly label: string;
  readonly accent: string;
  readonly surface: string;
  readonly surfaceDark: string;
  readonly border: string;
}

/** Chrome-style light tab group tints (accent + soft fill). */
export const THREAD_TAB_GROUP_COLORS: readonly ThreadTabGroupColor[] = [
  {
    id: "grey",
    label: "Grey",
    accent: "#5F6368",
    surface: "color-mix(in srgb, #5F6368 14%, transparent)",
    surfaceDark: "color-mix(in srgb, #9AA0A6 22%, transparent)",
    border: "color-mix(in srgb, #5F6368 38%, transparent)",
  },
  {
    id: "blue",
    label: "Blue",
    accent: "#1A73E8",
    surface: "color-mix(in srgb, #8AB4F8 28%, transparent)",
    surfaceDark: "color-mix(in srgb, #8AB4F8 24%, transparent)",
    border: "color-mix(in srgb, #1A73E8 34%, transparent)",
  },
  {
    id: "red",
    label: "Red",
    accent: "#D93025",
    surface: "color-mix(in srgb, #F28B82 26%, transparent)",
    surfaceDark: "color-mix(in srgb, #F28B82 22%, transparent)",
    border: "color-mix(in srgb, #D93025 32%, transparent)",
  },
  {
    id: "yellow",
    label: "Yellow",
    accent: "#F9AB00",
    surface: "color-mix(in srgb, #FDD663 30%, transparent)",
    surfaceDark: "color-mix(in srgb, #FDD663 20%, transparent)",
    border: "color-mix(in srgb, #F9AB00 34%, transparent)",
  },
  {
    id: "green",
    label: "Green",
    accent: "#188038",
    surface: "color-mix(in srgb, #81C995 28%, transparent)",
    surfaceDark: "color-mix(in srgb, #81C995 22%, transparent)",
    border: "color-mix(in srgb, #188038 32%, transparent)",
  },
  {
    id: "pink",
    label: "Pink",
    accent: "#D01884",
    surface: "color-mix(in srgb, #FF8BCB 24%, transparent)",
    surfaceDark: "color-mix(in srgb, #FF8BCB 20%, transparent)",
    border: "color-mix(in srgb, #D01884 30%, transparent)",
  },
  {
    id: "purple",
    label: "Purple",
    accent: "#9334E6",
    surface: "color-mix(in srgb, #C58AF9 26%, transparent)",
    surfaceDark: "color-mix(in srgb, #C58AF9 22%, transparent)",
    border: "color-mix(in srgb, #9334E6 32%, transparent)",
  },
  {
    id: "cyan",
    label: "Cyan",
    accent: "#007B83",
    surface: "color-mix(in srgb, #78D9EC 28%, transparent)",
    surfaceDark: "color-mix(in srgb, #78D9EC 22%, transparent)",
    border: "color-mix(in srgb, #007B83 30%, transparent)",
  },
  {
    id: "orange",
    label: "Orange",
    accent: "#E8710A",
    surface: "color-mix(in srgb, #FCAD70 30%, transparent)",
    surfaceDark: "color-mix(in srgb, #FCAD70 22%, transparent)",
    border: "color-mix(in srgb, #E8710A 34%, transparent)",
  },
] as const;

export interface ThreadTabGroup {
  readonly id: string;
  readonly name: string;
  readonly colorId: ThreadTabGroupColorId;
  readonly collapsed: boolean;
}

export type ThreadTabSegment =
  | {
      readonly kind: "ungrouped";
      readonly tabKeys: readonly ThreadTabKey[];
    }
  | {
      readonly kind: "group";
      readonly groupId: string;
      readonly tabKeys: readonly ThreadTabKey[];
    };

export function resolveThreadTabGroupColor(colorId: ThreadTabGroupColorId): ThreadTabGroupColor {
  return (
    THREAD_TAB_GROUP_COLORS.find((color) => color.id === colorId) ?? THREAD_TAB_GROUP_COLORS[0]!
  );
}

export function createThreadTabGroupId(): string {
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultThreadTabGroupName(existingCount: number): string {
  return `Group ${existingCount + 1}`;
}

export function pickDefaultThreadTabGroupColor(
  existingGroups: readonly ThreadTabGroup[],
): ThreadTabGroupColorId {
  const used = new Set(existingGroups.map((group) => group.colorId));
  const next = THREAD_TAB_GROUP_COLORS.find((color) => !used.has(color.id));
  return (
    next?.id ?? THREAD_TAB_GROUP_COLORS[existingGroups.length % THREAD_TAB_GROUP_COLORS.length]!.id
  );
}

export function segmentThreadTabsByGroup(
  openThreadTabKeys: readonly ThreadTabKey[],
  threadTabGroupByKey: Readonly<Record<string, string>>,
): ThreadTabSegment[] {
  const segments: ThreadTabSegment[] = [];
  let currentGroupId: string | null = null;
  let currentKeys: ThreadTabKey[] = [];

  const flush = () => {
    if (currentKeys.length === 0) {
      return;
    }
    if (currentGroupId) {
      segments.push({ kind: "group", groupId: currentGroupId, tabKeys: currentKeys });
    } else {
      segments.push({ kind: "ungrouped", tabKeys: currentKeys });
    }
    currentKeys = [];
  };

  for (const tabKey of openThreadTabKeys) {
    const groupId = threadTabGroupByKey[tabKey] ?? null;
    if (groupId !== currentGroupId) {
      flush();
      currentGroupId = groupId;
    }
    currentKeys.push(tabKey);
  }
  flush();
  return segments;
}

export function pruneThreadTabGroups(
  groups: readonly ThreadTabGroup[],
  groupByKey: Readonly<Record<string, string>>,
): {
  readonly threadTabGroups: ThreadTabGroup[];
  readonly threadTabGroupByKey: Record<string, string>;
} {
  const referencedGroupIds = new Set(Object.values(groupByKey));
  const threadTabGroups = groups.filter((group) => referencedGroupIds.has(group.id));
  const validIds = new Set(threadTabGroups.map((group) => group.id));
  const threadTabGroupByKey = Object.fromEntries(
    Object.entries(groupByKey).filter(([, groupId]) => validIds.has(groupId)),
  );
  return { threadTabGroups, threadTabGroupByKey };
}

export function removeThreadTabFromGroups(
  groupByKey: Readonly<Record<string, string>>,
  tabKey: ThreadTabKey,
): Record<string, string> {
  if (!(tabKey in groupByKey)) {
    return { ...groupByKey };
  }
  const next = { ...groupByKey };
  delete next[tabKey];
  return next;
}
