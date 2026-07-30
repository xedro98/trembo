import { FolderPlusIcon } from "lucide-react";

import { Button } from "../ui/button";

export function SidebarEmptyProjectsCallout(props: { readonly onAddProject: () => void }) {
  return (
    <div className="mx-2 mt-3 rounded-2xl border border-border/60 bg-background/45 px-3 py-4 text-center">
      <p className="text-sm font-medium text-foreground">No projects yet</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground/75">
        Add a local folder to start threads, run agents, and track work here.
      </p>
      <Button type="button" size="sm" className="mt-3" onClick={props.onAddProject}>
        <FolderPlusIcon className="size-4" />
        Add project
      </Button>
    </div>
  );
}
