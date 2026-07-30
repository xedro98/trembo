import { LogOutIcon, Undo2Icon } from "lucide-react";
import {
  createContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";

import { cn } from "../../lib/utils";
import {
  getDesktopTrumboAuthBridge,
  isTrumboSignedIn,
  useTrumboAuthState,
} from "../trumbo-auth/useTrumboAuthState";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { SettingsSectionId } from "./settingsNavItems";

type SettingsLayoutContextValue = {
  embedded: boolean;
  sectionId: SettingsSectionId;
  sectionLabel: string;
};

const SettingsLayoutContext = createContext<SettingsLayoutContextValue>({
  embedded: false,
  sectionId: "general",
  sectionLabel: "General",
});

export function SettingsLayoutProvider({
  embedded = false,
  sectionId = "general",
  sectionLabel = "General",
  children,
}: {
  embedded?: boolean;
  sectionId?: SettingsSectionId;
  sectionLabel?: string;
  children: ReactNode;
}) {
  const contextValue = useMemo(
    () => ({ embedded, sectionId, sectionLabel }),
    [embedded, sectionId, sectionLabel],
  );
  return <SettingsLayoutContext value={contextValue}>{children}</SettingsLayoutContext>;
}

function useSettingsLayout() {
  return use(SettingsLayoutContext);
}

/** Re-render every `intervalMs`; return a stable timestamp snapshot for render-time relative labels. */
export function useRelativeTimeTick(intervalMs = 1_000) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return nowMs;
}

export function SettingsSection({
  title,
  icon,
  headerAction,
  children,
  className,
  ...sectionProps
}: ComponentPropsWithoutRef<"section"> & {
  title: string;
  icon?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  const { embedded } = useSettingsLayout();

  return (
    <section {...sectionProps} className={cn(embedded ? "space-y-2.5" : "space-y-2", className)}>
      <div className="flex items-center justify-between gap-3 px-0.5">
        <h2
          className={cn(
            "flex min-w-0 items-center gap-2",
            embedded
              ? "text-[11px] font-medium tracking-[0.14em] text-muted-foreground/75 uppercase"
              : "text-[13px] font-medium text-foreground",
          )}
        >
          {!embedded && icon ? <span className="text-muted-foreground/75">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </h2>
        {headerAction ? (
          <div className="flex shrink-0 items-center justify-end">{headerAction}</div>
        ) : null}
      </div>
      <div
        className={cn(
          "divide-y overflow-hidden",
          embedded
            ? "settings-section-surface-embedded divide-border/45"
            : "settings-section-surface divide-border/55",
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  title,
  description,
  status,
  resetAction,
  control,
  children,
  className,
  ...rowProps
}: Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  title: ReactNode;
  description: ReactNode;
  status?: ReactNode;
  resetAction?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
}) {
  const { embedded } = useSettingsLayout();

  return (
    <div
      {...rowProps}
      className={cn(
        embedded ? "px-4 py-3.5 sm:px-5" : "px-4 sm:px-5",
        !embedded && (children ? "pt-3.5 pb-0" : "py-3.5"),
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-h-5 items-center gap-1.5">
            <h3
              className={cn(
                "tracking-[-0.01em] text-foreground",
                embedded ? "text-sm font-medium" : "text-[13px] font-medium",
              )}
            >
              {title}
            </h3>
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
              {resetAction}
            </span>
          </div>
          <p
            className={cn(
              "leading-relaxed text-muted-foreground/78",
              embedded ? "text-[13px]" : "text-xs",
            )}
          >
            {description}
          </p>
          {status ? (
            <div className="pt-0.5 text-[11px] text-muted-foreground/85">{status}</div>
          ) : null}
        </div>
        {control ? (
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
            {control}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function SettingResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Reset ${label} to default`}
            className="size-5 rounded-sm p-0 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            <Undo2Icon className="size-3" />
          </Button>
        }
      />
      <TooltipPopup side="top">Reset to default</TooltipPopup>
    </Tooltip>
  );
}

export function SettingsSignOutFooter() {
  const authState = useTrumboAuthState();
  if (!isTrumboSignedIn(authState)) {
    return null;
  }

  return (
    <div className="mt-2 border-t border-border/50 pt-5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => {
          const desktop = getDesktopTrumboAuthBridge() as
            | { signOut?: () => Promise<void> }
            | undefined;
          void desktop?.signOut?.();
        }}
      >
        <LogOutIcon className="size-3.5" />
        Sign out
      </Button>
    </div>
  );
}

export function SettingsSignOutSidebarAction() {
  const authState = useTrumboAuthState();
  if (!isTrumboSignedIn(authState)) {
    return null;
  }

  return (
    <button
      type="button"
      className="flex h-8 w-full items-center rounded-md px-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
      onClick={() => {
        const desktop = getDesktopTrumboAuthBridge() as
          | { signOut?: () => Promise<void> }
          | undefined;
        void desktop?.signOut?.();
      }}
    >
      Sign out
    </button>
  );
}

export function SettingsPageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { embedded } = useSettingsLayout();

  return (
    <div
      className={cn(
        "scrollbar-gutter-both flex-1 overflow-y-auto",
        !embedded && "settings-page-scroll",
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-col",
          embedded
            ? "gap-7 px-7 py-7 sm:px-8 sm:py-8"
            : "max-w-3xl gap-6 px-6 py-7 sm:px-8 sm:py-8",
          className,
        )}
      >
        {children}
        {!embedded ? <SettingsSignOutFooter /> : null}
      </div>
    </div>
  );
}
