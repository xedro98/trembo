import { cn } from "~/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

/** Full-height main pane that no longer depends on SidebarProvider peer styles. */
export function AppMain({ className, ...props }: ComponentPropsWithoutRef<"main">) {
  return (
    <main
      className={cn(
        "relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-background surface-grain",
        className,
      )}
      data-slot="app-main"
      {...props}
    />
  );
}
