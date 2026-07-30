import { useCallback } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { useCanGoBack, useNavigate } from "@tanstack/react-router";

import { cn } from "~/lib/utils";
import { openSettingsModal, setSettingsModalSection } from "~/settingsModalBus";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  SETTINGS_NAV_ITEMS,
  settingsSectionIdFromPath,
  type SettingsSectionId,
} from "./settingsNavItems";

/** @deprecated Settings now open in a modal. */
export function SettingsTabsNav({ pathname, className }: { pathname: string; className?: string }) {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
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
    <div className={cn("flex min-w-0 flex-1 items-center gap-1", className)} data-settings-tabs-nav>
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0 [-webkit-app-region:no-drag]"
        aria-label="Back"
        onClick={handleBackClick}
      >
        <ArrowLeftIcon />
      </Button>
      <ScrollArea hideScrollbars scrollFade className="min-w-0 flex-1 rounded-none">
        <div className="flex h-full w-max min-w-full items-center gap-1 px-1">
          {SETTINGS_NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSectionClick(item.id)}
                className={cn(
                  "inline-flex h-7 shrink-0 items-center rounded-md px-2 text-sm [-webkit-app-region:no-drag]",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/45 hover:text-foreground",
                )}
              >
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
