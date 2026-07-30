import { useAtomValue } from "@effect/atom-react";
import { KeyboardIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { isElectron } from "../../env";
import { shortcutLabelForCommand } from "../../keybindings";
import { cn } from "../../lib/utils";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { Button } from "../ui/button";
import { Kbd, KbdGroup } from "../ui/kbd";

const STORAGE_KEY = "trumbo.desktop.shortcutsHintDismissed";

function readDismissedFromStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissedToStorage(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

function ShortcutChip(props: { readonly label: string; readonly description: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
      <KbdGroup>
        {props.label.split("+").map((part) => (
          <Kbd key={part}>{part.trim()}</Kbd>
        ))}
      </KbdGroup>
      <span className="truncate text-xs text-muted-foreground">{props.description}</span>
    </div>
  );
}

export function DesktopShortcutsHint() {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const [dismissed, setDismissed] = useState(readDismissedFromStorage);

  const dismiss = useCallback(() => {
    writeDismissedToStorage();
    setDismissed(true);
  }, []);

  if (!isElectron || dismissed) {
    return null;
  }

  const commandPaletteLabel = shortcutLabelForCommand(keybindings, "commandPalette.toggle");
  const newThreadLabel = shortcutLabelForCommand(keybindings, "chat.new");
  const sidebarLabel = shortcutLabelForCommand(keybindings, "sidebar.toggle");

  if (!commandPaletteLabel && !newThreadLabel && !sidebarLabel) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-border/70",
          "bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-muted-foreground">
            <KeyboardIcon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Keyboard shortcuts</p>
            <p className="text-xs text-muted-foreground">
              Handy defaults while you explore the desktop app.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {commandPaletteLabel ? (
            <ShortcutChip label={commandPaletteLabel} description="Command palette" />
          ) : null}
          {newThreadLabel ? <ShortcutChip label={newThreadLabel} description="New thread" /> : null}
          {sidebarLabel ? <ShortcutChip label={sidebarLabel} description="Toggle sidebar" /> : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Dismiss keyboard shortcuts hint"
            onClick={dismiss}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
