import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { APP_DISPLAY_NAME } from "../branding";
import { isElectron } from "../env";
import { cn, isMacPlatform } from "../lib/utils";
import { TrumboWordmark } from "./TrumboWordmark";
import { AppChromeActions } from "./desktop/AppChromeActions";
import { ProjectPickerMenu } from "./desktop/ProjectPickerMenu";
import { ThreadTabBar } from "./desktop/ThreadTabBar";
import { SidebarProviderUpdatePill } from "./sidebar/SidebarProviderUpdatePill";
import { SidebarUpdatePill } from "./sidebar/SidebarUpdatePill";
import { openSettingsModal } from "../settingsModalBus";

const MACOS_TRAFFIC_LIGHTS_LEFT_INSET = "90px";

function AppBrand() {
  return (
    <Link
      aria-label="Go to threads"
      className={cn(
        "ml-[var(--workspace-titlebar-content-left)] flex h-7 w-fit min-w-0 shrink-0 items-center gap-2 overflow-hidden rounded-md outline-hidden ring-ring focus-visible:ring-2 [-webkit-app-region:no-drag]",
        "text-foreground",
      )}
      to="/"
    >
      <TrumboWordmark className="size-4" />
      <span className="truncate text-sm font-medium tracking-tight text-muted-foreground">
        {APP_DISPLAY_NAME}
      </span>
    </Link>
  );
}

/** @deprecated Prefer AppTabsLayout; kept as the historical export name for call sites. */
export function AppSidebarLayout({ children }: { children: ReactNode }) {
  return <AppTabsLayout>{children}</AppTabsLayout>;
}

export function AppTabsLayout({ children }: { children: ReactNode }) {
  const isMacosDesktop = isElectron && isMacPlatform(navigator.platform);
  const [isWindowFullscreen, setIsWindowFullscreen] = useState(() => {
    const getWindowFullscreenState = window.desktopBridge?.getWindowFullscreenState;
    return isMacosDesktop && typeof getWindowFullscreenState === "function"
      ? getWindowFullscreenState()
      : false;
  });
  const chromeStyle =
    isMacosDesktop && !isWindowFullscreen
      ? ({ "--workspace-controls-left": MACOS_TRAFFIC_LIGHTS_LEFT_INSET } as CSSProperties)
      : undefined;

  useEffect(() => {
    if (!isMacosDesktop) return;
    const bridge = window.desktopBridge;
    if (!bridge) return;
    const { getWindowFullscreenState, onWindowFullscreenStateChange } = bridge;
    if (
      typeof getWindowFullscreenState !== "function" ||
      typeof onWindowFullscreenStateChange !== "function"
    ) {
      return;
    }

    const unsubscribe = onWindowFullscreenStateChange(setIsWindowFullscreen);
    setIsWindowFullscreen(getWindowFullscreenState());
    return unsubscribe;
  }, [isMacosDesktop]);

  useEffect(() => {
    const onMenuAction = window.desktopBridge?.onMenuAction;
    if (typeof onMenuAction !== "function") {
      return;
    }

    const unsubscribe = onMenuAction((action) => {
      if (action === "open-settings") {
        openSettingsModal();
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return (
    <div
      className="flex h-dvh! min-h-0 w-full flex-col overflow-hidden bg-background text-foreground"
      style={chromeStyle}
      data-app-tabs-layout=""
    >
      <header
        className={cn(
          "workspace-topbar shrink-0 gap-2 border-b border-border px-2",
          isElectron && "drag-region",
        )}
        data-app-chrome=""
      >
        <div className="flex min-w-0 shrink-0 items-center gap-2 [-webkit-app-region:no-drag]">
          <AppBrand />
          <ProjectPickerMenu />
          <SidebarProviderUpdatePill />
          <SidebarUpdatePill />
        </div>
        <ThreadTabBar />
        <AppChromeActions />
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
