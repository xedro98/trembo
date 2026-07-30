import { type ProviderDriverKind, type ProviderInstanceId } from "@trumbo-code/contracts";
import { memo } from "react";
import { CheckIcon, StarIcon } from "lucide-react";
import {
  getDisplayModelName,
  getTriggerDisplayModelLabel,
  type ModelEsque,
  PROVIDER_ICON_BY_PROVIDER,
} from "./providerIconUtils";
import { Button } from "../ui/button";
import { Kbd } from "../ui/kbd";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { cn } from "~/lib/utils";

/**
 * Presentational model row for the rebuilt model picker.
 *
 * Detached from Base UI `ComboboxItem` so the picker owns its own
 * highlight/selection state and wheel scrolling. The row keeps the
 * exact same visual language (name + provider footer, favorite star,
 * jump kbd, NEW badge, selection check) via the `data-highlighted` /
 * `data-selected` attributes the Tailwind variants already target.
 */
export const ModelListRow = memo(function ModelListRow(props: {
  model: ModelEsque;
  /** Instance the model belongs to — used in the row's data key. */
  instanceId: ProviderInstanceId;
  /** Driver kind of the instance — used for the provider icon glyph. */
  driverKind: ProviderDriverKind;
  /**
   * Display name to show in the secondary line (provider footer). Usually
   * the instance's configured `displayName` so custom instances like
   * "Codex Personal" render with their user-authored label.
   */
  providerDisplayName: string;
  providerAccentColor?: string | undefined;
  isFavorite: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  showProvider: boolean;
  preferShortName?: boolean;
  useTriggerLabel?: boolean;
  showNewBadge?: boolean;
  jumpLabel?: string | null;
  disabledReason?: string | null;
  onToggleFavorite: () => void;
  onSelect: () => void;
  onHover: () => void;
}) {
  const ProviderIcon = PROVIDER_ICON_BY_PROVIDER[props.driverKind] ?? null;
  const providerLabel = props.model.subProvider
    ? `${props.providerDisplayName} · ${props.model.subProvider}`
    : props.providerDisplayName;
  const isDisabled = Boolean(props.disabledReason);

  const row = (
    <div
      role="option"
      aria-selected={props.isSelected}
      aria-disabled={isDisabled || undefined}
      data-model-key={`${props.instanceId}:${props.model.slug}`}
      data-highlighted={props.isHighlighted ? "" : undefined}
      data-selected={props.isSelected ? "" : undefined}
      data-disabled={isDisabled ? "" : undefined}
      tabIndex={-1}
      onClick={() => {
        if (isDisabled) return;
        props.onSelect();
      }}
      onMouseMove={props.onHover}
      className={cn(
        "group relative w-full min-w-0 max-w-full cursor-pointer rounded-md px-2 py-2.5 outline-none transition-[background-color,box-shadow,color]",
        "data-highlighted:bg-muted/56 data-selected:bg-transparent data-selected:text-foreground data-selected:ring-0",
        isDisabled &&
          "data-disabled:cursor-not-allowed data-disabled:pointer-events-auto data-disabled:hover:bg-transparent",
      )}
    >
      <div className="flex w-full items-center gap-3">
        <div className="min-w-0 flex-1 text-left">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 truncate text-xs font-medium leading-snug">
              {props.useTriggerLabel
                ? getTriggerDisplayModelLabel(props.model)
                : getDisplayModelName(
                    props.model,
                    props.preferShortName ? { preferShortName: true } : undefined,
                  )}
            </div>
            {props.isSelected ? <CheckIcon className="size-3.5 shrink-0 text-blue-400" /> : null}
            {props.showNewBadge ? (
              <span
                className="shrink-0 rounded border border-amber-500/35 bg-amber-500/15 px-0.5 py-px text-[10px] font-bold uppercase leading-none tracking-wide text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/12 dark:text-amber-200"
                aria-label="New model"
              >
                New
              </span>
            ) : null}
          </div>
          {props.showProvider && (
            <div className="mt-1 flex items-center gap-1.5">
              {ProviderIcon ? <ProviderIcon className="size-3 shrink-0" /> : null}
              <span className="truncate text-xs font-normal leading-snug text-muted-foreground/70">
                {providerLabel}
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {props.jumpLabel ? (
            <Kbd className="h-4 min-w-0 rounded-sm px-1.5 text-[10px]">{props.jumpLabel}</Kbd>
          ) : null}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className={cn(
                    "-mr-1 shrink-0 text-muted-foreground/70 opacity-64 transition-[color,opacity] hover:text-foreground hover:opacity-100 group-hover:opacity-100",
                    props.isFavorite && "text-foreground opacity-100",
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onToggleFavorite();
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                  }}
                  disabled={isDisabled}
                  aria-label={props.isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <StarIcon
                    className={cn(
                      "size-3.5 sm:size-3",
                      props.isFavorite && "fill-current text-yellow-500",
                    )}
                  />
                </Button>
              }
            />
            <TooltipPopup side="top" align="center">
              {props.isFavorite ? "Remove from favorites" : "Add to favorites"}
            </TooltipPopup>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  if (!isDisabled) {
    return row;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={row} />
      <TooltipPopup side="left" align="center" className="max-w-64 text-balance leading-snug">
        {props.disabledReason}
      </TooltipPopup>
    </Tooltip>
  );
});
