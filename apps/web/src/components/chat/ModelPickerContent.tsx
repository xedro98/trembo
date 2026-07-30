import {
  type ProviderInstanceId,
  type ProviderDriverKind,
  type ResolvedKeybindingsConfig,
} from "@trumbo-code/contracts";
import { resolveSelectableModel } from "@trumbo-code/shared/model";
import {
  memo,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useDeferredValue,
} from "react";
import { SearchIcon } from "lucide-react";
import { ModelListRow } from "./ModelListRow";
import { ModelPickerSidebar } from "./ModelPickerSidebar";
import { isModelPickerNewModel } from "./modelPickerModelHighlights";
import { buildModelPickerSearchText, scoreModelPickerSearch } from "./modelPickerSearch";
import { ModelEsque } from "./providerIconUtils";
import {
  modelPickerJumpCommandForIndex,
  modelPickerJumpIndexFromCommand,
  resolveShortcutCommand,
  shortcutLabelForCommand,
} from "../../keybindings";
import { useClientSettings, useUpdateClientSettings } from "~/hooks/useSettings";
import { cn } from "~/lib/utils";
import { TooltipProvider } from "../ui/tooltip";
import {
  isProviderInstancePickerReady,
  isProviderInstancePickerVisible,
  type ProviderInstanceEntry,
} from "../../providerInstances";
import { providerModelKey, sortProviderModelItems } from "../../modelOrdering";

type ModelPickerItem = {
  slug: string;
  name: string;
  shortName?: string;
  subProvider?: string;
  instanceId: ProviderInstanceId;
  driverKind: ProviderDriverKind;
  instanceDisplayName: string;
  instanceAccentColor?: string | undefined;
  continuationGroupKey?: string | undefined;
};

const EMPTY_JUMP_LABELS = new Map<string, string>();
const JUMP_PAGE_SIZE = 8;

/** Visible (filterable) row, with precomputed search text + favorite flag. */
type SearchableRow = {
  slug: string;
  instanceId: ProviderInstanceId;
  item: ModelPickerItem;
  key: string;
  searchText: string;
  isFavorite: boolean;
};

function splitInstanceModelKey(key: string): { instanceId: ProviderInstanceId; slug: string } {
  const colonIndex = key.indexOf(":");
  if (colonIndex === -1) {
    return { instanceId: key as ProviderInstanceId, slug: "" };
  }
  return {
    instanceId: key.slice(0, colonIndex) as ProviderInstanceId,
    slug: key.slice(colonIndex + 1),
  };
}

export const ModelPickerContent = memo(function ModelPickerContent(props: {
  activeInstanceId: ProviderInstanceId;
  model: string;
  lockedProvider: ProviderDriverKind | null;
  lockedContinuationGroupKey?: string | null;
  instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  keybindings?: ResolvedKeybindingsConfig;
  modelOptionsByInstance: ReadonlyMap<ProviderInstanceId, ReadonlyArray<ModelEsque>>;
  terminalOpen: boolean;
  onRequestClose?: () => void;
  getModelDisabledReason?: (instanceId: ProviderInstanceId, model: string) => string | null;
  onInstanceModelChange: (instanceId: ProviderInstanceId, model: string) => void;
}) {
  const {
    keybindings: providedKeybindings,
    modelOptionsByInstance,
    instanceEntries,
    getModelDisabledReason,
    onInstanceModelChange,
  } = props;

  const [searchQuery, setSearchQuery] = useState("");
  // Deferred search keeps the input snappy on huge catalogs: typing
  // updates the field immediately, the (potentially expensive) rank pass
  // runs on the deferred value so the input never blocks.
  const deferredQuery = useDeferredValue(searchQuery);
  const [showTopScrollFade, setShowTopScrollFade] = useState(false);
  const [showBottomScrollFade, setShowBottomScrollFade] = useState(false);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const favorites = useClientSettings((s) => s.favorites ?? []);
  const [selectedInstanceId, setSelectedInstanceId] = useState<ProviderInstanceId | "favorites">(
    () => {
      if (props.lockedProvider !== null) {
        return props.activeInstanceId;
      }
      return favorites.length > 0 ? "favorites" : props.activeInstanceId;
    },
  );
  const keybindings = useMemo<ResolvedKeybindingsConfig>(
    () => providedKeybindings ?? [],
    [providedKeybindings],
  );
  const updateSettings = useUpdateClientSettings();

  const favoritesSet = useMemo(
    () => new Set(favorites.map((fav) => providerModelKey(fav.provider, fav.model))),
    [favorites],
  );

  const entryByInstanceId = useMemo(
    () => new Map(instanceEntries.map((entry) => [entry.instanceId, entry])),
    [instanceEntries],
  );

  const matchesLockedProvider = useCallback(
    (entry: Pick<ProviderInstanceEntry, "driverKind" | "continuationGroupKey">): boolean => {
      if (props.lockedProvider === null) return true;
      if (entry.driverKind !== props.lockedProvider) return false;
      if (!props.lockedContinuationGroupKey) return true;
      return entry.continuationGroupKey === props.lockedContinuationGroupKey;
    },
    [props.lockedContinuationGroupKey, props.lockedProvider],
  );

  const readyInstanceSet = useMemo(() => {
    const ready = new Set<ProviderInstanceId>();
    for (const entry of instanceEntries) {
      if (isProviderInstancePickerReady(entry)) {
        ready.add(entry.instanceId);
      }
    }
    return ready;
  }, [instanceEntries]);

  // Flatten every ready instance's models into searchable rows, with
  // precomputed search text so the per-keystroke rank pass never rebuilds
  // the normalized fields. Recomputed only when the catalog or favorites
  // change — not on every query.
  const searchableRows = useMemo<ReadonlyArray<SearchableRow>>(() => {
    const out: SearchableRow[] = [];
    for (const [instanceId, models] of modelOptionsByInstance) {
      const entry = entryByInstanceId.get(instanceId);
      if (!entry || !readyInstanceSet.has(instanceId)) continue;
      for (const model of models) {
        const key = providerModelKey(instanceId, model.slug);
        out.push({
          slug: model.slug,
          instanceId,
          item: {
            slug: model.slug,
            name: model.name,
            ...(model.shortName ? { shortName: model.shortName } : {}),
            ...(model.subProvider ? { subProvider: model.subProvider } : {}),
            instanceId,
            driverKind: entry.driverKind,
            instanceDisplayName: entry.displayName,
            ...(entry.accentColor ? { instanceAccentColor: entry.accentColor } : {}),
            ...(entry.continuationGroupKey
              ? { continuationGroupKey: entry.continuationGroupKey }
              : {}),
          },
          key,
          searchText: buildModelPickerSearchText({
            name: model.name,
            ...(model.shortName ? { shortName: model.shortName } : {}),
            ...(model.subProvider ? { subProvider: model.subProvider } : {}),
            driverKind: entry.driverKind,
            providerDisplayName: entry.displayName,
          }),
          isFavorite: favoritesSet.has(key),
        });
      }
    }
    return out;
  }, [modelOptionsByInstance, entryByInstanceId, readyInstanceSet, favoritesSet]);

  const isLocked = props.lockedProvider !== null;
  const isSearching = deferredQuery.trim().length > 0;
  const instanceOrder = useMemo(
    () => instanceEntries.map((entry) => entry.instanceId),
    [instanceEntries],
  );

  const lockedDisabledInstanceIds = useMemo(() => {
    if (!isLocked) return undefined;
    const disabled = new Set<ProviderInstanceId>();
    for (const entry of instanceEntries) {
      if (!matchesLockedProvider(entry)) disabled.add(entry.instanceId);
    }
    return disabled;
  }, [instanceEntries, isLocked, matchesLockedProvider]);

  const sidebarInstanceEntries = useMemo(() => {
    const enabledEntries = instanceEntries.filter(isProviderInstancePickerVisible);
    if (!isLocked) return enabledEntries;
    const available: ProviderInstanceEntry[] = [];
    const disabled: ProviderInstanceEntry[] = [];
    for (const entry of enabledEntries) {
      if (matchesLockedProvider(entry)) available.push(entry);
      else disabled.push(entry);
    }
    return [...available, ...disabled];
  }, [instanceEntries, isLocked, matchesLockedProvider]);
  const showSidebar = !isSearching && sidebarInstanceEntries.length > 0;

  // Single source of truth for what's rendered. When searching, rank
  // across the whole catalog (respecting locked driver). Otherwise filter
  // to the selected rail (instance or favorites) and apply stable ordering.
  const filteredRows = useMemo<ReadonlyArray<SearchableRow>>(() => {
    const query = deferredQuery.trim();
    if (query) {
      const ranked: Array<{ row: SearchableRow; score: number; tieBreaker: string }> = [];
      for (const row of searchableRows) {
        if (isLocked && !matchesLockedProvider(row.item)) continue;
        const score = scoreModelPickerSearch(
          {
            name: row.item.name,
            ...(row.item.shortName ? { shortName: row.item.shortName } : {}),
            ...(row.item.subProvider ? { subProvider: row.item.subProvider } : {}),
            driverKind: row.item.driverKind,
            providerDisplayName: row.item.instanceDisplayName,
            isFavorite: row.isFavorite,
          },
          query,
        );
        if (score === null) continue;
        ranked.push({ row, score, tieBreaker: row.searchText });
      }
      ranked.sort((a, b) => {
        const delta = a.score - b.score;
        if (delta !== 0) return delta;
        if (a.row.isFavorite !== b.row.isFavorite) return a.row.isFavorite ? -1 : 1;
        return a.tieBreaker.localeCompare(b.tieBreaker);
      });
      return ranked.map((entry) => entry.row);
    }

    let rows = searchableRows;
    if (isLocked) {
      rows = rows.filter((row) => matchesLockedProvider(row.item));
    }
    if (selectedInstanceId === "favorites") {
      rows = rows.filter((row) => row.isFavorite);
    } else {
      rows = rows.filter((row) => row.item.instanceId === selectedInstanceId);
    }
    return sortProviderModelItems(rows, {
      favoriteModelKeys: favoritesSet,
      groupFavorites: selectedInstanceId !== "favorites",
      instanceOrder: selectedInstanceId === "favorites" ? instanceOrder : [],
    });
  }, [
    deferredQuery,
    favoritesSet,
    instanceOrder,
    isLocked,
    matchesLockedProvider,
    searchableRows,
    selectedInstanceId,
  ]);

  const filteredKeys = useMemo(() => filteredRows.map((row) => row.key), [filteredRows]);
  // Indices of selectable (non-disabled) rows, for keyboard navigation.
  const selectableKeys = useMemo(
    () =>
      filteredKeys.filter((key) => {
        const { instanceId, slug } = splitInstanceModelKey(key);
        return !getModelDisabledReason?.(instanceId, slug);
      }),
    [filteredKeys, getModelDisabledReason],
  );

  // Jump-shortcut labels (e.g. ⌘1..⌘9) for the first N selectable rows.
  const modelJumpLabelByKey = useMemo((): ReadonlyMap<string, string> => {
    let count = 0;
    const mapping = new Map<string, string>();
    const shortcutLabelOptions = {
      platform: navigator.platform,
      context: {
        terminalFocus: false,
        terminalOpen: props.terminalOpen,
        modelPickerOpen: true,
      } as const,
    };
    for (const key of selectableKeys) {
      const command = modelPickerJumpCommandForIndex(count);
      if (!command) break;
      const label = shortcutLabelForCommand(keybindings, command, shortcutLabelOptions);
      if (label) mapping.set(key, label);
      count += 1;
    }
    return mapping.size > 0 ? mapping : EMPTY_JUMP_LABELS;
  }, [keybindings, props.terminalOpen, selectableKeys]);

  const handleModelSelect = useCallback(
    (instanceId: ProviderInstanceId, modelSlug: string) => {
      if (getModelDisabledReason?.(instanceId, modelSlug)) return;
      const options = modelOptionsByInstance.get(instanceId);
      if (!options) return;
      const entry = entryByInstanceId.get(instanceId);
      if (!entry) return;
      const resolvedModel = resolveSelectableModel(entry.driverKind, modelSlug, options);
      if (resolvedModel) onInstanceModelChange(instanceId, resolvedModel);
    },
    [entryByInstanceId, getModelDisabledReason, modelOptionsByInstance, onInstanceModelChange],
  );

  const selectByKey = useCallback(
    (key: string) => {
      const { instanceId, slug } = splitInstanceModelKey(key);
      handleModelSelect(instanceId, slug);
    },
    [handleModelSelect],
  );

  const toggleFavorite = useCallback(
    (instanceId: ProviderInstanceId, model: string) => {
      const next = [...favorites];
      const index = next.findIndex((f) => f.provider === instanceId && f.model === model);
      if (index >= 0) next.splice(index, 1);
      else next.push({ provider: instanceId, model });
      updateSettings({ favorites: next });
    },
    [favorites, updateSettings],
  );

  const focusSearchInput = useCallback(() => {
    searchInputRef.current?.focus({ preventScroll: true });
  }, []);

  const handleSelectInstance = useCallback(
    (instanceId: ProviderInstanceId | "favorites") => {
      setSelectedInstanceId(instanceId);
      setSearchQuery("");
      window.requestAnimationFrame(focusSearchInput);
    },
    [focusSearchInput],
  );

  // Auto-focus the search field on mount and when the sidebar selection
  // changes (keeps keyboard flow: click rail → type to search).
  useLayoutEffect(() => {
    focusSearchInput();
  }, [focusSearchInput, selectedInstanceId]);

  // Keep the highlighted row valid + visible as the filtered set changes.
  // On open / rail switch / cleared search, prime the highlight to the
  // active model (or the first selectable row) so Enter "just works".
  useLayoutEffect(() => {
    const activeKey = `${props.activeInstanceId}:${props.model}`;
    let next: string | null;
    if (filteredKeys.length === 0) {
      next = null;
    } else if (filteredKeys.includes(activeKey)) {
      const { instanceId: aid, slug: aslug } = splitInstanceModelKey(activeKey);
      next = getModelDisabledReason?.(aid, aslug) ? (selectableKeys[0] ?? null) : activeKey;
    } else {
      next = selectableKeys[0] ?? null;
    }
    setHighlightedKey(next);
  }, [filteredKeys, selectableKeys, props.activeInstanceId, props.model]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !highlightedKey) return;
    const target = el.querySelector<HTMLElement>(
      `[data-model-key="${CSS.escape(highlightedKey)}"]`,
    );
    target?.scrollIntoView({ block: "nearest" });
  }, [highlightedKey]);

  const updateScrollFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    setShowTopScrollFade(el.scrollTop > 1);
    setShowBottomScrollFade(max - el.scrollTop > 1);
  }, []);

  useLayoutEffect(() => {
    setShowTopScrollFade(false);
    setShowBottomScrollFade(filteredKeys.length > 6);
    const frame = window.requestAnimationFrame(updateScrollFades);
    return () => window.cancelAnimationFrame(frame);
  }, [filteredKeys, updateScrollFades]);

  // Keyboard jump shortcuts (⌘1..⌘9 etc.) — resolved from keybindings.
  const modelJumpShortcutContext = useMemo(
    () =>
      ({
        terminalFocus: false,
        terminalOpen: props.terminalOpen,
        modelPickerOpen: true,
      }) as const,
    [props.terminalOpen],
  );
  useEffect(() => {
    const onWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      const command = resolveShortcutCommand(event, keybindings, {
        platform: navigator.platform,
        context: modelJumpShortcutContext,
      });
      const jumpIndex = modelPickerJumpIndexFromCommand(command ?? "");
      if (jumpIndex === null) return;
      const targetKey = selectableKeys[jumpIndex];
      if (!targetKey) return;
      event.preventDefault();
      event.stopPropagation();
      selectByKey(targetKey);
    };
    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
  }, [keybindings, modelJumpShortcutContext, selectByKey, selectableKeys]);

  const moveHighlight = useCallback(
    (delta: number) => {
      if (selectableKeys.length === 0) return;
      const currentIdx = highlightedKey ? selectableKeys.indexOf(highlightedKey) : -1;
      let nextIdx: number;
      if (currentIdx === -1) {
        nextIdx = delta > 0 ? 0 : selectableKeys.length - 1;
      } else {
        nextIdx = currentIdx + delta;
      }
      if (nextIdx < 0) nextIdx = 0;
      if (nextIdx > selectableKeys.length - 1) nextIdx = selectableKeys.length - 1;
      setHighlightedKey(selectableKeys[nextIdx] ?? null);
    },
    [highlightedKey, selectableKeys],
  );

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      props.onRequestClose?.();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const target = highlightedKey ?? selectableKeys[0];
      if (target) selectByKey(target);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setHighlightedKey(selectableKeys[0] ?? null);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setHighlightedKey(selectableKeys[selectableKeys.length - 1] ?? null);
      return;
    }
    if (e.key === "PageDown") {
      e.preventDefault();
      moveHighlight(JUMP_PAGE_SIZE);
      return;
    }
    if (e.key === "PageUp") {
      e.preventDefault();
      moveHighlight(-JUMP_PAGE_SIZE);
      return;
    }
    e.stopPropagation();
  };

  return (
    <TooltipProvider delay={0}>
      <div
        className="relative flex h-screen max-h-96 w-screen max-w-100 flex-row overflow-hidden rounded-lg border bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]"
        data-model-picker-content="true"
        data-model-picker-scroll="true"
      >
        {showSidebar && (
          <ModelPickerSidebar
            selectedInstanceId={selectedInstanceId}
            onSelectInstance={handleSelectInstance}
            instanceEntries={sidebarInstanceEntries}
            showFavorites
            {...(lockedDisabledInstanceIds
              ? {
                  disabledInstanceIds: lockedDisabledInstanceIds,
                  getDisabledInstanceTooltip: (entry: ProviderInstanceEntry) =>
                    `${entry.displayName} is unavailable in this thread. Start a new thread to switch providers.`,
                }
              : {})}
          />
        )}

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/40",
            showSidebar && "border-l",
          )}
        >
          {/* Search */}
          <div className="shrink-0 px-4 pt-2.5">
            <div className="-translate-y-px border-b border-border/70 pb-2.5 transition-colors focus-within:border-ring">
              <div className="relative flex items-center">
                <SearchIcon className="-translate-x-0.5 size-4 shrink-0 text-muted-foreground/55" />
                <input
                  ref={searchInputRef}
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  spellCheck={false}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  placeholder="Search models..."
                  aria-label="Search models"
                  aria-controls="model-picker-listbox"
                  aria-autocomplete="list"
                  className="h-6.5 w-full border-0 bg-transparent ps-1.5 text-sm leading-6.5 text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
          </div>

          {/* List — native scroll for reliable wheel + touch. */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={scrollRef}
              id="model-picker-listbox"
              role="listbox"
              onScroll={updateScrollFades}
              className={cn(
                "scrollbar-gutter-both h-full overflow-y-auto overscroll-y-contain py-1.5 [--fade-size:1.5rem]",
                showTopScrollFade && "mask-t-from-[calc(100%-var(--fade-size))]",
                showBottomScrollFade && "mask-b-from-[calc(100%-var(--fade-size))]",
              )}
            >
              {filteredRows.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs font-normal leading-snug text-muted-foreground">
                  No models found
                </p>
              ) : (
                filteredRows.map((row) => {
                  const disabledReason =
                    getModelDisabledReason?.(row.item.instanceId, row.item.slug) ?? null;
                  return (
                    <ModelListRow
                      key={row.key}
                      model={row.item}
                      instanceId={row.item.instanceId}
                      driverKind={row.item.driverKind}
                      providerDisplayName={row.item.instanceDisplayName}
                      providerAccentColor={row.item.instanceAccentColor}
                      isFavorite={row.isFavorite}
                      isSelected={row.key === `${props.activeInstanceId}:${props.model}`}
                      isHighlighted={row.key === highlightedKey}
                      showProvider
                      preferShortName={!isLocked}
                      useTriggerLabel={false}
                      showNewBadge={isModelPickerNewModel(row.item.driverKind, row.item.slug)}
                      jumpLabel={modelJumpLabelByKey.get(row.key) ?? null}
                      disabledReason={disabledReason}
                      onToggleFavorite={() => toggleFavorite(row.item.instanceId, row.item.slug)}
                      onSelect={() => selectByKey(row.key)}
                      onHover={() => setHighlightedKey(row.key)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
});
