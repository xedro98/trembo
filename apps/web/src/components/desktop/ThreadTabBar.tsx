import type { ContextMenuItem } from "@trumbo-code/contracts";
import {
  parseScopedThreadKey,
  scopeThreadRef,
  scopedThreadKey,
} from "@trumbo-code/client-runtime/environment";
import { ChevronRightIcon, MessageSquareIcon, X } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "@tanstack/react-router";

import { DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { readLocalApi } from "~/localApi";
import { cn } from "~/lib/utils";
import { useThreadShells } from "~/state/entities";
import {
  buildDraftThreadRouteParams,
  buildThreadRouteParams,
  resolveThreadRouteTarget,
} from "~/threadRoutes";
import {
  resolveThreadTabGroupColor,
  segmentThreadTabsByGroup,
  THREAD_TAB_GROUP_COLORS,
  type ThreadTabGroupColorId,
} from "~/threadTabGroups";
import { useUiStateStore } from "~/uiStateStore";
import {
  parseDraftThreadTabKey,
  resolveNeighborThreadTab,
  threadTabKeyFromRouteTarget,
  type ThreadTabKey,
} from "~/threadTabs";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

type TabContextMenuAction =
  | "close"
  | "close-others"
  | "close-to-right"
  | "close-all"
  | "new-group"
  | "remove-from-group"
  | "rename-group"
  | "toggle-group-collapsed"
  | "add-to-group-menu"
  | "color-menu"
  | `add-to-group:${string}`
  | `set-color:${ThreadTabGroupColorId}`;

function resolveTabTitle(input: {
  key: ThreadTabKey;
  shellTitleByKey: ReadonlyMap<string, string>;
  draftExists: boolean;
}): string {
  if (parseDraftThreadTabKey(input.key)) {
    return input.draftExists ? "New thread" : "Closed draft";
  }
  return input.shellTitleByKey.get(input.key) ?? "Thread";
}

function ThreadTabButton({
  tabKey,
  title,
  active,
  groupColor,
  onNavigate,
  onClose,
  onContextMenu,
  onMouseDown,
  onAuxClick,
}: {
  readonly tabKey: ThreadTabKey;
  readonly title: string;
  readonly active: boolean;
  readonly groupColor?: { accent: string; surface: string; border: string };
  readonly onNavigate: () => void;
  readonly onClose: () => void;
  readonly onContextMenu: (event: ReactMouseEvent) => void;
  readonly onMouseDown: (event: ReactMouseEvent) => void;
  readonly onAuxClick: (event: ReactMouseEvent) => void;
}) {
  return (
    <div
      data-active-tab={active}
      data-thread-tab={tabKey}
      onMouseDown={onMouseDown}
      onAuxClick={onAuxClick}
      onContextMenu={onContextMenu}
      className={cn(
        "group flex h-7 min-w-25 max-w-44 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm [-webkit-app-region:no-drag]",
        active
          ? "bg-background/90 text-foreground shadow-sm ring-1 ring-border/60"
          : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
      )}
      style={
        groupColor
          ? {
              backgroundColor: active ? groupColor.surface : undefined,
            }
          : undefined
      }
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1.5"
              onClick={onNavigate}
            >
              <MessageSquareIcon className="size-3.5 shrink-0 opacity-70" />
              <span className="truncate">{title}</span>
            </button>
          }
        />
        <TooltipPopup>{title}</TooltipPopup>
      </Tooltip>
      <button
        type="button"
        className="relative flex size-4 shrink-0 items-center justify-center rounded opacity-0 hover:bg-muted focus:opacity-100 group-hover:opacity-100"
        aria-label={`Close ${title}`}
        onClick={onClose}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export function ThreadTabBar() {
  const navigate = useNavigate();
  const routeParams = useParams({ strict: false });
  const routeTarget = resolveThreadRouteTarget(routeParams);
  const activeTabKey = routeTarget ? threadTabKeyFromRouteTarget(routeTarget) : null;

  const openThreadTabKeys = useUiStateStore((state) => state.openThreadTabKeys);
  const threadTabGroups = useUiStateStore((state) => state.threadTabGroups);
  const threadTabGroupByKey = useUiStateStore((state) => state.threadTabGroupByKey);
  const openThreadTab = useUiStateStore((state) => state.openThreadTab);
  const closeThreadTabAction = useUiStateStore((state) => state.closeThreadTab);
  const closeOtherThreadTabsAction = useUiStateStore((state) => state.closeOtherThreadTabs);
  const closeThreadTabsToRightAction = useUiStateStore((state) => state.closeThreadTabsToRight);
  const closeAllThreadTabsAction = useUiStateStore((state) => state.closeAllThreadTabs);
  const createThreadTabGroupAction = useUiStateStore((state) => state.createThreadTabGroup);
  const updateThreadTabGroupAction = useUiStateStore((state) => state.updateThreadTabGroup);
  const assignThreadTabToGroupAction = useUiStateStore((state) => state.assignThreadTabToGroup);
  const toggleThreadTabGroupCollapsedAction = useUiStateStore(
    (state) => state.toggleThreadTabGroupCollapsed,
  );

  const shells = useThreadShells();
  const shellTitleByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const shell of shells) {
      map.set(
        scopedThreadKey(scopeThreadRef(shell.environmentId, shell.id)),
        shell.title || "Untitled",
      );
    }
    return map;
  }, [shells]);

  const draftSessionsById = useComposerDraftStore((state) => state.draftThreadsByThreadKey);
  const tabListRef = useRef<HTMLDivElement>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const segments = useMemo(
    () => segmentThreadTabsByGroup(openThreadTabKeys, threadTabGroupByKey),
    [openThreadTabKeys, threadTabGroupByKey],
  );

  const groupById = useMemo(
    () => new Map(threadTabGroups.map((group) => [group.id, group] as const)),
    [threadTabGroups],
  );

  useEffect(() => {
    if (!activeTabKey) return;
    openThreadTab(activeTabKey);
  }, [activeTabKey, openThreadTab]);

  const navigateToTab = useCallback(
    (key: ThreadTabKey) => {
      const draftId = parseDraftThreadTabKey(key);
      if (draftId) {
        void navigate({
          to: "/draft/$draftId",
          params: buildDraftThreadRouteParams(DraftId.make(draftId)),
        });
        return;
      }
      const threadRef = parseScopedThreadKey(key);
      if (!threadRef) return;
      void navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(threadRef),
      });
    },
    [navigate],
  );

  const handleCloseTab = useCallback(
    (key: ThreadTabKey) => {
      const neighbor =
        activeTabKey === key ? resolveNeighborThreadTab(openThreadTabKeys, key) : null;
      closeThreadTabAction(key);
      if (activeTabKey !== key) {
        return;
      }
      if (neighbor) {
        navigateToTab(neighbor);
        return;
      }
      void navigate({ to: "/" });
    },
    [activeTabKey, closeThreadTabAction, navigate, navigateToTab, openThreadTabKeys],
  );

  const handleCloseOthers = useCallback(
    (key: ThreadTabKey) => {
      closeOtherThreadTabsAction(key);
      if (activeTabKey !== key) {
        navigateToTab(key);
      }
    },
    [activeTabKey, closeOtherThreadTabsAction, navigateToTab],
  );

  const handleCloseToRight = useCallback(
    (key: ThreadTabKey) => {
      closeThreadTabsToRightAction(key);
      if (
        activeTabKey &&
        openThreadTabKeys.indexOf(activeTabKey) > openThreadTabKeys.indexOf(key)
      ) {
        navigateToTab(key);
      }
    },
    [activeTabKey, closeThreadTabsToRightAction, navigateToTab, openThreadTabKeys],
  );

  const handleCloseAll = useCallback(() => {
    closeAllThreadTabsAction();
    void navigate({ to: "/" });
  }, [closeAllThreadTabsAction, navigate]);

  const commitGroupRename = useCallback(
    (groupId: string) => {
      const trimmed = renameDraft.trim();
      if (trimmed) {
        updateThreadTabGroupAction(groupId, { name: trimmed });
      }
      setRenamingGroupId(null);
      setRenameDraft("");
    },
    [renameDraft, updateThreadTabGroupAction],
  );

  const handleTabContextMenu = useCallback(
    async (event: ReactMouseEvent, key: ThreadTabKey) => {
      event.preventDefault();
      event.stopPropagation();

      const api = readLocalApi();
      if (!api) return;

      const tabIndex = openThreadTabKeys.indexOf(key);
      if (tabIndex < 0) return;

      const currentGroupId = threadTabGroupByKey[key];
      const currentGroup = currentGroupId ? groupById.get(currentGroupId) : undefined;

      const items: ContextMenuItem<TabContextMenuAction>[] = [
        { id: "new-group", label: "Add tab to new group" },
        ...(threadTabGroups.length > 0
          ? [
              {
                id: "add-to-group-menu",
                label: "Add tab to group",
                children: threadTabGroups.map((group) => ({
                  id: `add-to-group:${group.id}` as TabContextMenuAction,
                  label: group.name,
                  disabled: currentGroupId === group.id,
                })),
              } satisfies ContextMenuItem<TabContextMenuAction>,
            ]
          : []),
        ...(currentGroupId
          ? [
              {
                id: "remove-from-group",
                label: "Remove from group",
              } satisfies ContextMenuItem<TabContextMenuAction>,
            ]
          : []),
        ...(currentGroup
          ? [
              {
                id: "rename-group",
                label: "Rename group",
              } satisfies ContextMenuItem<TabContextMenuAction>,
              {
                id: "toggle-group-collapsed",
                label: currentGroup.collapsed ? "Expand group" : "Collapse group",
              } satisfies ContextMenuItem<TabContextMenuAction>,
              {
                id: "color-menu",
                label: "Group color",
                children: THREAD_TAB_GROUP_COLORS.map((color) => ({
                  id: `set-color:${color.id}` as TabContextMenuAction,
                  label: color.label,
                })),
              } satisfies ContextMenuItem<TabContextMenuAction>,
            ]
          : []),
        { id: "close", label: "Close" },
        {
          id: "close-others",
          label: "Close others",
          disabled: openThreadTabKeys.length <= 1,
        },
        {
          id: "close-to-right",
          label: "Close to the right",
          disabled: tabIndex >= openThreadTabKeys.length - 1,
        },
        {
          id: "close-all",
          label: "Close all",
          disabled: openThreadTabKeys.length === 0,
        },
      ];

      const action = await api.contextMenu.show(items, { x: event.clientX, y: event.clientY });
      if (!action) return;

      if (action === "new-group") {
        createThreadTabGroupAction({ tabKey: key });
        return;
      }
      if (action === "remove-from-group") {
        assignThreadTabToGroupAction(key, null);
        return;
      }
      if (action === "rename-group" && currentGroupId) {
        setRenamingGroupId(currentGroupId);
        setRenameDraft(currentGroup?.name ?? "");
        return;
      }
      if (action === "toggle-group-collapsed" && currentGroupId) {
        toggleThreadTabGroupCollapsedAction(currentGroupId);
        return;
      }
      if (action.startsWith("add-to-group:")) {
        assignThreadTabToGroupAction(key, action.slice("add-to-group:".length));
        return;
      }
      if (action.startsWith("set-color:") && currentGroupId) {
        updateThreadTabGroupAction(currentGroupId, {
          colorId: action.slice("set-color:".length) as ThreadTabGroupColorId,
        });
        return;
      }
      switch (action) {
        case "close":
          handleCloseTab(key);
          break;
        case "close-others":
          handleCloseOthers(key);
          break;
        case "close-to-right":
          handleCloseToRight(key);
          break;
        case "close-all":
          handleCloseAll();
          break;
      }
    },
    [
      assignThreadTabToGroupAction,
      createThreadTabGroupAction,
      groupById,
      handleCloseAll,
      handleCloseOthers,
      handleCloseTab,
      handleCloseToRight,
      openThreadTabKeys,
      threadTabGroupByKey,
      threadTabGroups,
      toggleThreadTabGroupCollapsedAction,
      updateThreadTabGroupAction,
    ],
  );

  const handleTabMouseDown = useCallback((event: ReactMouseEvent) => {
    if (event.button !== 1) return;
    event.preventDefault();
  }, []);

  const handleTabAuxClick = useCallback(
    (event: ReactMouseEvent, key: ThreadTabKey) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      handleCloseTab(key);
    },
    [handleCloseTab],
  );

  useEffect(() => {
    const activeTab = tabListRef.current?.querySelector<HTMLElement>("[data-active-tab='true']");
    activeTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabKey]);

  useEffect(() => {
    for (const key of openThreadTabKeys) {
      const draftId = parseDraftThreadTabKey(key);
      if (!draftId) continue;
      if (draftSessionsById[DraftId.make(draftId)]) continue;
      if (key === activeTabKey) continue;
      closeThreadTabAction(key);
    }
  }, [activeTabKey, closeThreadTabAction, draftSessionsById, openThreadTabKeys]);

  if (openThreadTabKeys.length === 0) {
    return null;
  }

  const renderTab = (
    key: ThreadTabKey,
    groupColor?: ReturnType<typeof resolveThreadTabGroupColor>,
  ) => {
    const draftId = parseDraftThreadTabKey(key);
    const title = resolveTabTitle({
      key,
      shellTitleByKey,
      draftExists: draftId ? Boolean(draftSessionsById[DraftId.make(draftId)]) : false,
    });
    const palette = groupColor
      ? {
          accent: groupColor.accent,
          surface: groupColor.surface,
          border: groupColor.border,
        }
      : undefined;

    return (
      <ThreadTabButton
        key={key}
        tabKey={key}
        title={title}
        active={key === activeTabKey}
        {...(palette ? { groupColor: palette } : {})}
        onNavigate={() => navigateToTab(key)}
        onClose={() => handleCloseTab(key)}
        onContextMenu={(event) => void handleTabContextMenu(event, key)}
        onMouseDown={handleTabMouseDown}
        onAuxClick={(event) => handleTabAuxClick(event, key)}
      />
    );
  };

  return (
    <ScrollArea
      ref={tabListRef}
      hideScrollbars
      scrollFade
      className="min-w-0 flex-1 rounded-none drag-region"
      data-thread-tab-list
    >
      <div className="flex h-full w-max min-w-full items-center gap-1.5 px-1">
        {segments.map((segment) => {
          if (segment.kind === "ungrouped") {
            return segment.tabKeys.map((key) => renderTab(key));
          }

          const group = groupById.get(segment.groupId);
          if (!group) {
            return segment.tabKeys.map((key) => renderTab(key));
          }

          const palette = resolveThreadTabGroupColor(group.colorId);
          const isRenaming = renamingGroupId === group.id;

          return (
            <div
              key={group.id}
              className="flex h-8 shrink-0 items-center gap-1 rounded-lg border px-1 py-0.5 [-webkit-app-region:no-drag]"
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
              }}
              data-thread-tab-group={group.id}
            >
              <button
                type="button"
                className="flex max-w-36 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium"
                style={{ color: palette.accent }}
                onClick={() => toggleThreadTabGroupCollapsedAction(group.id)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setRenamingGroupId(group.id);
                  setRenameDraft(group.name);
                }}
              >
                <ChevronRightIcon
                  className={cn(
                    "size-3 shrink-0 transition-transform",
                    group.collapsed ? "" : "rotate-90",
                  )}
                />
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onBlur={() => commitGroupRename(group.id)}
                    onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitGroupRename(group.id);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setRenamingGroupId(null);
                        setRenameDraft("");
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                    style={{ color: palette.accent }}
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : (
                  <span className="truncate">{group.name}</span>
                )}
                {group.collapsed ? (
                  <span className="rounded-full bg-background/70 px-1.5 py-0 text-[10px] font-semibold text-muted-foreground">
                    {segment.tabKeys.length}
                  </span>
                ) : null}
              </button>
              {!group.collapsed
                ? segment.tabKeys.map((key) => renderTab(key, palette))
                : segment.tabKeys
                    .filter((key) => key === activeTabKey)
                    .map((key) => renderTab(key, palette))}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
