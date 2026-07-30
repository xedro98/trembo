import { RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/utils";
import {
  closeSettingsModal,
  getSettingsModalState,
  setSettingsModalSection,
  subscribeSettingsModal,
} from "~/settingsModalBus";
import { Button } from "~/components/ui/button";
import { Dialog, DialogPopup } from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useSettingsRestore } from "./SettingsPanels";
import { SettingsLayoutProvider, SettingsSignOutSidebarAction } from "./settingsLayout";
import {
  resolveSettingsNavItems,
  resolveSettingsNavLabel,
  type SettingsSectionId,
} from "./settingsNavItems";
import { SettingsSectionPanel } from "./settingsPanelsRegistry";

function RestoreDefaultsButton({ onRestored }: { onRestored: () => void }) {
  const { changedSettingLabels, restoreDefaults } = useSettingsRestore(onRestored);

  return (
    <Button
      size="xs"
      variant="outline"
      className="h-7 rounded-md border-border/70 bg-background/80 px-2.5 text-xs"
      disabled={changedSettingLabels.length === 0}
      onClick={() => void restoreDefaults()}
    >
      <RotateCcwIcon className="size-3.5" />
      Restore defaults
    </Button>
  );
}

function SettingsModalNav({
  activeSection,
  onSelect,
}: {
  activeSection: SettingsSectionId;
  onSelect: (section: SettingsSectionId) => void;
}) {
  const navItems = resolveSettingsNavItems();

  return (
    <nav
      className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2"
      aria-label="Settings sections"
    >
      {navItems.map((item) => {
        const isActive = item.id === activeSection;
        return (
          <button
            key={item.id}
            type="button"
            data-active={isActive ? "true" : undefined}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-8 w-full items-center rounded-md px-2.5 text-left text-[13px] transition-colors",
              isActive
                ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border/55"
                : "text-muted-foreground hover:bg-background/55 hover:text-foreground",
            )}
            onClick={() => onSelect(item.id)}
          >
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function SettingsModal() {
  const [modalState, setModalState] = useState(() => getSettingsModalState());
  const [restoreSignal, setRestoreSignal] = useState(0);

  useEffect(() => subscribeSettingsModal(setModalState), []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      closeSettingsModal();
    }
  }, []);

  const handleSectionSelect = useCallback((section: SettingsSectionId) => {
    setSettingsModalSection(section);
  }, []);

  const handleRestored = useCallback(() => {
    setRestoreSignal((value) => value + 1);
  }, []);

  const activeLabel = resolveSettingsNavLabel(modalState.section);
  const showRestoreDefaults = modalState.section === "general";

  return (
    <Dialog open={modalState.open} onOpenChange={handleOpenChange}>
      <DialogPopup
        showCloseButton
        bottomStickOnMobile={false}
        className="settings-workspace-modal flex h-[min(88vh,780px)] max-h-[88vh] w-[min(96vw,1040px)] max-w-none flex-col overflow-hidden rounded-xl border-border/55 bg-muted/20 p-0 shadow-xl/8"
        data-settings-modal
      >
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="settings-workspace-sidebar flex w-[15.5rem] shrink-0 flex-col border-r border-border/50">
            <div className="border-b border-border/45 px-4 py-4">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                Workspace
              </p>
              <h2 className="mt-1 text-lg font-medium tracking-tight text-foreground">Settings</h2>
              <p className="mt-1 text-sm font-medium tracking-tight text-muted-foreground/75">
                Preferences, providers, and connections.
              </p>
            </div>

            <SettingsModalNav activeSection={modalState.section} onSelect={handleSectionSelect} />

            <div className="mt-auto border-t border-border/45 px-3 py-3">
              <SettingsSignOutSidebarAction />
            </div>
          </aside>

          <section className="settings-workspace-content flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/45 px-7 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                  Preferences
                </p>
                <h2 className="mt-1 text-lg font-medium tracking-tight text-foreground">
                  {activeLabel}
                </h2>
              </div>
              {showRestoreDefaults ? <RestoreDefaultsButton onRestored={handleRestored} /> : null}
            </div>

            <SettingsLayoutProvider
              embedded
              sectionId={modalState.section}
              sectionLabel={activeLabel}
            >
              <ScrollArea scrollFade className="min-h-0 min-w-0 flex-1">
                <div key={`${modalState.section}:${restoreSignal}`} className="min-h-0">
                  <SettingsSectionPanel sectionId={modalState.section} />
                </div>
              </ScrollArea>
            </SettingsLayoutProvider>
          </section>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
