import { FolderPlusIcon, SquarePenIcon } from "lucide-react";

import { DesktopGettingStarted } from "./desktop/DesktopGettingStarted";
import { ReadyToBuildHero } from "./desktop/ReadyToBuildHero";
import { useOpenAddProjectCommandPalette } from "../commandPaletteContext";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { AppMain } from "./AppMain";
import { isElectron } from "../env";
import { Button } from "./ui/button";

export function NoActiveThreadState() {
  return (
    <AppMain className="min-h-0">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        {isElectron ? <DesktopGettingStarted /> : <WebEmptyThreadState />}
      </div>
    </AppMain>
  );
}

function WebEmptyThreadState() {
  const openAddProject = useOpenAddProjectCommandPalette();
  const { defaultProjectRef, handleNewThread } = useHandleNewThread();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center">
      <ReadyToBuildHero className="-mt-2 mb-2" />
      <h1 className="text-lg font-medium tracking-tight text-foreground">Ready to build</h1>
      <p className="mt-2 max-w-sm text-sm font-medium tracking-tight text-muted-foreground">
        Open a thread from the tab bar, or start a fresh one below.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col items-center gap-2">
        {defaultProjectRef ? (
          <Button
            type="button"
            size="sm"
            className="h-9 w-full gap-2 rounded-md px-4 text-sm font-medium tracking-tight"
            onClick={() => void handleNewThread(defaultProjectRef)}
          >
            <SquarePenIcon className="size-3.5 opacity-70" />
            New thread
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="h-9 w-full gap-2 rounded-md px-4 text-sm font-medium tracking-tight"
            onClick={openAddProject}
          >
            <FolderPlusIcon className="size-3.5 opacity-70" />
            Add a project
          </Button>
        )}
      </div>
    </div>
  );
}
