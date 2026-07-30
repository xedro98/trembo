import { PlusIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { memo, useCallback } from "react";

import { openCommandPalette } from "~/commandPaletteBus";
import { openSettingsModal } from "~/settingsModalBus";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import { startNewThreadFromContext } from "~/lib/chatThreadActions";
import { cn } from "~/lib/utils";
import { TrumboSidebarHeaderAuth } from "~/components/trumbo-auth/TrumboSidebarHeaderAuth";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

export const AppChromeActions = memo(function AppChromeActions() {
  const { activeDraftThread, activeThread, defaultProjectRef, handleNewThread } =
    useHandleNewThread();

  const handleNewThreadClick = useCallback(() => {
    void startNewThreadFromContext({
      activeDraftThread,
      activeThread: activeThread ?? undefined,
      defaultProjectRef,
      handleNewThread,
    });
  }, [activeDraftThread, activeThread, defaultProjectRef, handleNewThread]);

  const handleSettingsClick = useCallback(() => {
    openSettingsModal();
  }, []);

  return (
    <div
      className={cn(
        "ms-auto flex shrink-0 items-center gap-1 pr-2 [-webkit-app-region:no-drag]",
        "wco:pr-[calc(var(--workspace-native-controls-inset)+0.5rem)]",
      )}
      data-app-chrome-actions
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="New thread"
              onClick={handleNewThreadClick}
            />
          }
        >
          <PlusIcon />
        </TooltipTrigger>
        <TooltipPopup side="bottom">New thread</TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Search"
              onClick={() => openCommandPalette()}
            />
          }
        >
          <SearchIcon />
        </TooltipTrigger>
        <TooltipPopup side="bottom">Search</TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Settings"
              onClick={handleSettingsClick}
            />
          }
        >
          <SettingsIcon />
        </TooltipTrigger>
        <TooltipPopup side="bottom">Settings</TooltipPopup>
      </Tooltip>
      <div className="ms-1 flex items-center gap-1">
        <TrumboSidebarHeaderAuth />
      </div>
    </div>
  );
});
