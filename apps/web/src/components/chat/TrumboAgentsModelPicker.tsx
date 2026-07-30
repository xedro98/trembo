import type { ProviderInstanceId } from "@trumbo-code/contracts";
import { CheckIcon, ChevronDownIcon, LockIcon, SearchIcon } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { fetchPlatformModelCatalog } from "../../lib/platformModelCatalog";
import { cn } from "~/lib/utils";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { ModelLabLogo } from "./ModelLabLogo";

interface ModelOption {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly locked?: boolean;
  readonly disabledReason?: string | null;
}

export interface TrumboAgentsModelPickerProps {
  readonly value: string;
  readonly onChange: (modelId: string) => void;
  readonly planTier?: string | null;
  readonly accessToken?: string;
  readonly fallbackCatalog?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly description?: string;
  }>;
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly className?: string;
  readonly triggerClassName?: string;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly modelAccessBlocked?: boolean;
  readonly getModelDisabledReason?: (
    instanceId: ProviderInstanceId,
    model: string,
  ) => string | null;
  readonly instanceId: ProviderInstanceId;
}

const QUARTZ_VARIANTS: ReadonlyArray<ModelOption> = [
  {
    id: "quartz-1.0",
    name: "Quartz 1.0",
    description: "Balanced reasoning — default thinking depth",
  },
  {
    id: "quartz-1.0-lite",
    name: "Quartz Lite",
    description: "Faster replies with lighter thinking",
  },
  {
    id: "quartz-1.0-hyper",
    name: "Quartz Hyper",
    description: "Maximum thinking depth (Max/Ultra)",
  },
];

export function tierAllowsHyper(tier?: string | null): boolean {
  const normalized = (tier ?? "").toLowerCase();
  return normalized === "max" || normalized === "ultra" || normalized === "enterprise";
}

function filterModels(list: ReadonlyArray<ModelOption>, query: string): ModelOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...list];
  return list.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.description?.toLowerCase().includes(q) ?? false),
  );
}

/**
 * Flattened, section-aware list entry. Headers are non-selectable landmarks;
 * model entries carry the option + a stable key for highlight/scroll.
 */
type ListEntry =
  | { kind: "header"; key: string; label: string }
  | { kind: "model"; key: string; model: ModelOption };

const PAGE_SIZE = 6;

function modelKey(id: string): string {
  return `model:${id}`;
}

export const TrumboAgentsModelPicker = memo(function TrumboAgentsModelPicker(
  props: TrumboAgentsModelPickerProps,
) {
  const [catalog, setCatalog] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const open = props.open ?? uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      props.onOpenChange?.(next);
      if (props.open === undefined) setUncontrolledOpen(next);
    },
    [props.onOpenChange, props.open],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const toOptions = (
      list: ReadonlyArray<{ id: string; name: string; description?: string | null }>,
    ): ModelOption[] =>
      list
        .map((m): ModelOption => {
          const base: ModelOption = { id: m.id, name: m.name };
          const desc = m.description ?? undefined;
          return desc ? { ...base, description: desc } : base;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    const apply = (next: ModelOption[]) => {
      setCatalog((prev) =>
        prev.length === next.length &&
        prev.every((e, i) => e.id === next[i]?.id && e.name === next[i]?.name)
          ? prev
          : next,
      );
    };

    try {
      const remote = await fetchPlatformModelCatalog(props.accessToken);
      apply(remote.length > 0 ? toOptions(remote) : toOptions(props.fallbackCatalog ?? []));
    } catch {
      apply(toOptions(props.fallbackCatalog ?? []));
    } finally {
      setLoading(false);
    }
  }, [props.accessToken, props.fallbackCatalog]);

  useEffect(() => {
    void load();
  }, [load]);

  // Build the two model buckets with access/lock/disabled reasoning applied.
  const quartz = useMemo<ModelOption[]>(() => {
    const allowHyper = tierAllowsHyper(props.planTier);
    const accessBlocked = props.modelAccessBlocked === true;
    return QUARTZ_VARIANTS.map((variant) => {
      const disabledReason = props.getModelDisabledReason?.(props.instanceId, variant.id) ?? null;
      if (accessBlocked && disabledReason) return { ...variant, locked: true, disabledReason };
      if (variant.id === "quartz-1.0-hyper" && !allowHyper)
        return { ...variant, locked: true, disabledReason };
      if (disabledReason) return { ...variant, disabledReason };
      return variant;
    });
  }, [props.getModelDisabledReason, props.instanceId, props.modelAccessBlocked, props.planTier]);

  const allModels = useMemo<ModelOption[]>(() => {
    const quartzIds = new Set(quartz.map((e) => e.id));
    const accessBlocked = props.modelAccessBlocked === true;
    return catalog
      .filter((e) => !quartzIds.has(e.id))
      .map((e) => {
        const disabledReason = props.getModelDisabledReason?.(props.instanceId, e.id) ?? null;
        if (accessBlocked && disabledReason) return { ...e, locked: true, disabledReason };
        return { ...e, disabledReason };
      });
  }, [catalog, props.getModelDisabledReason, props.instanceId, props.modelAccessBlocked, quartz]);

  const filteredQuartz = useMemo(() => filterModels(quartz, search), [quartz, search]);
  const filteredAll = useMemo(() => filterModels(allModels, search), [allModels, search]);

  // Flatten into a section-aware list with stable keys. Order: Quartz first,
  // then All models. Headers only appear when their section is non-empty.
  const entries = useMemo<ListEntry[]>(() => {
    const out: ListEntry[] = [];
    if (filteredQuartz.length > 0) {
      out.push({ kind: "header", key: "header:quartz", label: "Quartz" });
      for (const m of filteredQuartz) out.push({ kind: "model", key: modelKey(m.id), model: m });
    }
    if (filteredAll.length > 0) {
      out.push({ kind: "header", key: "header:all", label: "All models" });
      for (const m of filteredAll) out.push({ kind: "model", key: modelKey(m.id), model: m });
    }
    return out;
  }, [filteredQuartz, filteredAll]);

  // Selectable model keys (non-disabled), in render order — drives keyboard nav.
  const selectableKeys = useMemo(
    () =>
      entries
        .filter((e): e is Extract<ListEntry, { kind: "model" }> => e.kind === "model")
        .filter((e) => !e.model.locked && !e.model.disabledReason)
        .map((e) => e.key),
    [entries],
  );

  const empty = filteredQuartz.length === 0 && filteredAll.length === 0;

  const selectedModel =
    quartz.find((m) => m.id === props.value) ??
    allModels.find((m) => m.id === props.value) ??
    catalog.find((m) => m.id === props.value);
  const selectedName = selectedModel?.name ?? props.value;

  const handleSelect = useCallback(
    (model: ModelOption) => {
      if (model.locked || model.disabledReason) return;
      props.onChange(model.id);
      setOpen(false);
      setSearch("");
    },
    [props.onChange, setOpen],
  );

  const selectByKey = useCallback(
    (key: string) => {
      const entry = entries.find((e) => e.key === key);
      if (entry && entry.kind === "model") handleSelect(entry.model);
    },
    [entries, handleSelect],
  );

  const moveHighlight = useCallback(
    (delta: number) => {
      if (selectableKeys.length === 0) return;
      setHighlightedKey((current) => {
        const idx = current ? selectableKeys.indexOf(current) : -1;
        let nextIdx: number;
        if (idx === -1) {
          nextIdx = delta > 0 ? 0 : selectableKeys.length - 1;
        } else {
          nextIdx = idx + delta;
        }
        if (nextIdx < 0) nextIdx = 0;
        if (nextIdx > selectableKeys.length - 1) nextIdx = selectableKeys.length - 1;
        return selectableKeys[nextIdx] ?? null;
      });
    },
    [selectableKeys],
  );

  // Prime highlight to the active model (or first selectable) whenever the
  // list changes so Enter "just works" without needing to arrow down first.
  useLayoutEffect(() => {
    if (!open) return;
    const activeKey = modelKey(props.value);
    let next: string | null;
    if (selectableKeys.length === 0) {
      next = null;
    } else if (selectableKeys.includes(activeKey)) {
      next = activeKey;
    } else {
      next = selectableKeys[0] ?? null;
    }
    setHighlightedKey(next);
  }, [open, selectableKeys, props.value]);

  // Keep the highlighted row scrolled into view during keyboard navigation.
  useLayoutEffect(() => {
    if (!highlightedKey) return;
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(highlightedKey)}"]`);
    target?.scrollIntoView({ block: "nearest" });
  }, [highlightedKey]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (props.disabled) {
      setOpen(false);
      return;
    }
    setOpen(next);
    if (!next) setSearch("");
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
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
      moveHighlight(PAGE_SIZE);
      return;
    }
    if (e.key === "PageUp") {
      e.preventDefault();
      moveHighlight(-PAGE_SIZE);
      return;
    }
    e.stopPropagation();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={props.disabled}
            data-chat-provider-model-picker="true"
            data-state={open ? "open" : "closed"}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label="Select model"
            aria-expanded={open}
            className={cn(
              "input-surface inline-flex h-8 max-w-[14rem] items-center justify-between gap-1.5 px-2.5 py-0 text-xs font-medium shadow-none hover:bg-muted/20 data-[state=open]:bg-muted/30",
              props.compact ? "max-w-48 shrink-0" : "max-w-56 shrink sm:max-w-64",
              props.triggerClassName,
              props.className,
            )}
          />
        }
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selectedModel ? (
            <ModelLabLogo
              key={selectedModel.id}
              modelId={selectedModel.id}
              modelName={selectedModel.name}
              className="size-3.5"
            />
          ) : null}
          <span className="truncate normal-case">{selectedName}</span>
        </span>
        <ChevronDownIcon
          className={cn("size-3.5 shrink-0 opacity-50 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </PopoverTrigger>

      <PopoverPopup
        align="start"
        side="top"
        sideOffset={8}
        className="flex w-[min(22rem,calc(100vw-2rem))] max-h-[min(26rem,60vh)] flex-col overflow-hidden rounded-md border-[color:var(--input-surface-border)] p-0 shadow-none before:hidden"
        viewportClassName="flex max-h-[min(26rem,60vh)] min-h-0 flex-col overflow-hidden p-0 [--viewport-inline-padding:0]"
      >
        {/* Search */}
        <div className="shrink-0 border-b border-[color:var(--input-surface-border)] px-4 py-2.5">
          <div className="relative flex items-center">
            <SearchIcon
              className="pointer-events-none absolute left-0 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="text"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={onSearchKeyDown}
              aria-label="Search models"
              aria-controls="trumbo-model-listbox"
              aria-autocomplete="list"
              placeholder="Search models…"
              className="h-9 w-full border-0 bg-transparent pl-6 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* List — native scroll for reliable wheel + touch. */}
        <div
          ref={scrollRef}
          id="trumbo-model-listbox"
          role="listbox"
          data-model-picker-content="true"
          data-model-picker-scroll="true"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
        >
          {loading && empty ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">Loading models…</p>
          ) : empty ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No models match your search.
            </p>
          ) : (
            entries.map((entry) => {
              if (entry.kind === "header") {
                return (
                  <p
                    key={entry.key}
                    className="sticky top-0 z-10 border-b border-[color:var(--input-surface-border)] bg-popover px-4 py-2.5 font-stat text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {entry.label}
                  </p>
                );
              }
              const model = entry.model;
              const active = model.id === props.value;
              const isDisabled = Boolean(model.locked || model.disabledReason);
              const isHighlighted = entry.key === highlightedKey;
              return (
                <div
                  key={entry.key}
                  data-row-key={entry.key}
                  role="option"
                  aria-selected={active}
                  aria-disabled={isDisabled || undefined}
                  data-highlighted={isHighlighted ? "" : undefined}
                  data-selected={active ? "" : undefined}
                  data-disabled={isDisabled ? "" : undefined}
                  tabIndex={-1}
                  title={model.disabledReason ?? undefined}
                  onClick={() => {
                    if (isDisabled) return;
                    handleSelect(model);
                  }}
                  onMouseMove={() => setHighlightedKey(entry.key)}
                  className={cn(
                    "relative flex h-auto min-h-11 w-full cursor-pointer select-none items-start gap-3 border-b border-[color:var(--input-surface-border)] px-4 py-2.5 text-left text-sm font-medium outline-none transition-colors last:border-b-0",
                    "data-highlighted:bg-muted/40 data-selected:bg-muted/40",
                    isDisabled && "data-disabled:cursor-not-allowed data-disabled:opacity-50",
                  )}
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                    <ModelLabLogo modelId={model.id} modelName={model.name} />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-2">
                      <span className="block min-w-0 flex-1 text-sm leading-snug font-medium text-foreground">
                        {model.name}
                      </span>
                      {model.locked ? (
                        <LockIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      ) : active ? (
                        <CheckIcon className="size-4 shrink-0 text-foreground" aria-hidden />
                      ) : null}
                    </span>
                    {model.description ? (
                      <span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug font-normal text-muted-foreground">
                        {model.description}
                      </span>
                    ) : null}
                    {model.disabledReason ? (
                      <span className="mt-0.5 block text-[11px] leading-snug font-normal text-muted-foreground">
                        {model.disabledReason}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </PopoverPopup>
    </Popover>
  );
});
