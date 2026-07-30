import { useCallback } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { useCanGoBack, useNavigate } from "@tanstack/react-router";

import { cn } from "../../lib/utils";
import { openSettingsModal, setSettingsModalSection } from "../../settingsModalBus";
import {
  resolveSettingsNavItems,
  settingsSectionIdFromPath,
  type SettingsSectionId,
} from "./settingsNavItems";

export type { SettingsSectionId, SettingsSectionPath } from "./settingsNavItems";

function SettingsNavItem({
  label,
  isActive,
  onClick,
}: {
  readonly label: string;
  readonly isActive: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={isActive ? "true" : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-8 w-full items-center rounded-md px-2.5 text-left text-[13px] transition-colors",
        isActive
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/45 hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

/** @deprecated Settings now open in a modal. Kept for legacy sidebar layouts. */
export function SettingsSidebarNav({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const settingsNavItems = resolveSettingsNavItems();
  const activeSection = settingsSectionIdFromPath(pathname) ?? "general";

  const handleSectionClick = useCallback((section: SettingsSectionId) => {
    openSettingsModal(section);
    setSettingsModalSection(section);
  }, []);

  const handleBackClick = useCallback(() => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  }, [canGoBack, navigate]);

  return (
    <aside
      className="relative z-10 flex w-[18rem] min-w-[18rem] shrink-0 flex-col overflow-y-auto border-r border-border bg-background"
      aria-label="Settings"
      data-settings-sidebar
    >
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-3 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={handleBackClick}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4 shrink-0" />
          <span>Back</span>
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-3" aria-label="Settings sections">
        {settingsNavItems.map((item) => (
          <SettingsNavItem
            key={item.id}
            label={item.label}
            isActive={activeSection === item.id}
            onClick={() => handleSectionClick(item.id)}
          />
        ))}
      </nav>
    </aside>
  );
}
