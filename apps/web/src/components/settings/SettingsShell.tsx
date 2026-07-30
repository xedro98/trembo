import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { SettingsSidebarNav } from "./SettingsSidebarNav";

export function SettingsShell({
  pathname,
  children,
  className,
}: {
  readonly pathname: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn("flex min-h-0 w-full flex-1 overflow-hidden bg-background", className)}
      data-settings-shell
    >
      <SettingsSidebarNav pathname={pathname} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
