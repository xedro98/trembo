import { useRef, useState, useEffect } from "react";
import { openSettingsModal } from "../../settingsModalBus";
import type { TrumboAuthState, TrumboAuthUser, TrumboSubscription } from "@trumbo-code/contracts";
import { LogInIcon, SettingsIcon, LogOutIcon, ChevronDownIcon } from "lucide-react";

import { hasCloudPublicConfig } from "../../cloud/publicConfig";
import { isElectron } from "../../env";
import { isNativeTrumboDesktop } from "../../lib/nativeTrumboDesktop";
import { BoringAvatar } from "../ui/boring-avatar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { useTrumboConnectAuthPrompt } from "./useTrumboConnectAuthPrompt";
import {
  getDesktopTrumboAuthBridge,
  isTrumboSignedIn,
  useTrumboAuthState,
} from "./useTrumboAuthState";

interface DesktopTrumboAuthBridge {
  startSignIn: () => Promise<unknown>;
  cancelSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<TrumboAuthState>;
}

function getDesktopTrumboAuth(): DesktopTrumboAuthBridge | undefined {
  return getDesktopTrumboAuthBridge() as DesktopTrumboAuthBridge | undefined;
}

function shouldRenderTrumboSidebarAccount(): boolean {
  return (
    isElectron ||
    hasCloudPublicConfig() ||
    Boolean(getDesktopTrumboAuthBridge()) ||
    isNativeTrumboDesktop()
  );
}

function resolveSidebarTrumboUser(
  state: TrumboAuthState & { status: "signed-in" },
): TrumboAuthUser {
  if (state.user) {
    return state.user;
  }

  return {
    id: "trumbo-account",
    email: "Trumbo account",
    name: "Trumbo account",
  };
}

const TIER_BADGE_LABELS: Readonly<Record<TrumboSubscription["tier"], string>> = {
  free: "Free",
  pro: "Pro",
  max: "Max",
  ultra: "Ultra",
};

export function TrumboConnectSidebarSignIn() {
  if (!shouldRenderTrumboSidebarAccount()) return null;

  return <ConfiguredTrumboConnectSidebarSignIn />;
}

export function TrumboConnectSidebarAvatar() {
  if (!shouldRenderTrumboSidebarAccount()) return null;

  return <ConfiguredTrumboConnectSidebarAvatar />;
}

/** Sidebar footer account row: avatar menu when signed in, sign-in CTA when signed out. */
export function TrumboSidebarAccount() {
  if (!shouldRenderTrumboSidebarAccount()) return null;

  return <ConfiguredTrumboSidebarAccount />;
}

function ConfiguredTrumboSidebarAccount() {
  const state = useTrumboAuthState();
  const desktop = getDesktopTrumboAuth();

  if (isTrumboSignedIn(state)) {
    const user = resolveSidebarTrumboUser(state);
    const subscription = state.subscription as TrumboSubscription | undefined;
    const tier = subscription?.tier;

    return (
      <TrumboAvatarDropdown
        user={user}
        {...(tier ? { tierLabel: TIER_BADGE_LABELS[tier] } : {})}
        onSignOut={() => {
          void desktop?.signOut();
        }}
      />
    );
  }

  return <ConfiguredTrumboConnectSidebarSignIn />;
}

function ConfiguredTrumboConnectSidebarAvatar() {
  const state = useTrumboAuthState();
  const desktop = getDesktopTrumboAuth();

  if (!isTrumboSignedIn(state)) return null;

  const user = resolveSidebarTrumboUser(state);
  const subscription = state.subscription as TrumboSubscription | undefined;
  const tier = subscription?.tier;

  return (
    <TrumboAvatarDropdown
      user={user}
      {...(tier ? { tierLabel: TIER_BADGE_LABELS[tier] } : {})}
      onSignOut={() => {
        void desktop?.signOut();
      }}
    />
  );
}

function ConfiguredTrumboConnectSidebarSignIn() {
  const state = useTrumboAuthState();
  const { authPrompt, openAuthPrompt } = useTrumboConnectAuthPrompt();

  if (isTrumboSignedIn(state)) return null;

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="sm"
            className="gap-2 px-2 py-2.5 font-stat text-sm font-medium leading-tight text-muted-foreground transition-colors hover:text-brand"
            onClick={() => void openAuthPrompt()}
          >
            <LogInIcon className="size-4" />
            <span>Sign in to Trumbo</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      {authPrompt}
    </>
  );
}

function TrumboAvatarDropdown({
  user,
  tierLabel,
  onSignOut,
}: {
  user: TrumboAuthUser;
  tierLabel?: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
      >
        <BoringAvatar
          name={user.name ?? user.email ?? "?"}
          avatarUrl={user.avatarUrl}
          size={28}
          className="size-7 shrink-0"
        />
        <div className="min-w-0 flex-1 text-left">
          <div className="font-stat truncate text-sm font-medium leading-tight text-foreground">
            {user.name ?? user.email}
          </div>
          {tierLabel ? (
            <div className="font-stat truncate text-[11px] leading-tight text-muted-foreground/70 mt-0.5">
              Trumbo {tierLabel}
            </div>
          ) : null}
        </div>
        <ChevronDownIcon
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-lg border border-grid-line bg-popover shadow-md">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openSettingsModal();
            }}
            className="font-stat flex w-full items-center gap-2.5 border-b border-b-dotted border-grid-line px-3 py-2.5 text-sm font-medium leading-none text-muted-foreground transition-colors hover:text-brand"
          >
            <SettingsIcon className="size-4 shrink-0 text-muted-foreground" />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="font-stat flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium leading-none text-muted-foreground transition-colors hover:text-brand"
          >
            <LogOutIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span>Sign out</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
