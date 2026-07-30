import { isNativeTrumboDesktop } from "../../lib/nativeTrumboDesktop";

export type SettingsSectionId =
  | "general"
  | "usage"
  | "keybindings"
  | "providers"
  | "source-control"
  | "connections"
  | "archived"
  | "schedules"
  | "mcp"
  | "cloud-agents"
  | "diagnostics";

export type SettingsSectionPath = `/settings/${SettingsSectionId}`;

const SETTINGS_SECTION_IDS = new Set<string>([
  "general",
  "usage",
  "keybindings",
  "providers",
  "source-control",
  "connections",
  "archived",
  "schedules",
  "mcp",
  "cloud-agents",
  "diagnostics",
]);

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTION_IDS.has(value);
}

export function settingsSectionPath(section: SettingsSectionId): SettingsSectionPath {
  return `/settings/${section}`;
}

export function settingsSectionIdFromPath(pathname: string): SettingsSectionId | null {
  if (pathname === "/settings" || pathname === "/settings/") {
    return "general";
  }
  const match = pathname.match(/^\/settings\/([^/]+)/);
  if (!match?.[1] || !isSettingsSectionId(match[1])) {
    return null;
  }
  return match[1];
}

const BASE_SETTINGS_NAV_ITEMS: ReadonlyArray<{
  id: SettingsSectionId;
  label: string;
}> = [
  { id: "general", label: "General" },
  { id: "keybindings", label: "Keybindings" },
  { id: "providers", label: "Providers" },
  { id: "source-control", label: "Source Control" },
  { id: "connections", label: "Connections" },
  { id: "archived", label: "Archive" },
];

const USAGE_SETTINGS_NAV_ITEM = {
  id: "usage",
  label: "Usage",
} as const satisfies { id: SettingsSectionId; label: string };

const DESKTOP_ECOSYSTEM_NAV_ITEMS = [
  { id: "schedules", label: "Schedules" },
  { id: "mcp", label: "MCP" },
  { id: "cloud-agents", label: "Cloud agents" },
] as const satisfies ReadonlyArray<{ id: SettingsSectionId; label: string }>;

export function resolveSettingsNavItems(): ReadonlyArray<{
  id: SettingsSectionId;
  label: string;
}> {
  if (!isNativeTrumboDesktop()) {
    return BASE_SETTINGS_NAV_ITEMS;
  }
  return [
    BASE_SETTINGS_NAV_ITEMS[0]!,
    USAGE_SETTINGS_NAV_ITEM,
    ...DESKTOP_ECOSYSTEM_NAV_ITEMS,
    ...BASE_SETTINGS_NAV_ITEMS.slice(1),
  ];
}

export const SETTINGS_NAV_ITEMS = resolveSettingsNavItems();

export function resolveSettingsNavLabel(sectionId: SettingsSectionId): string {
  return SETTINGS_NAV_ITEMS.find((item) => item.id === sectionId)?.label ?? "Settings";
}
