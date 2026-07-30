import type { SettingsSectionId } from "./settingsNavItems";
import {
  ArchivedThreadsPanel,
  GeneralSettingsPanel,
  ProviderSettingsPanel,
} from "./SettingsPanels";
import { CloudAgentsSettingsPanel } from "./CloudAgentsSettingsPanel";
import { ConnectionsSettings } from "./ConnectionsSettings";
import { DiagnosticsSettingsPanel } from "./DiagnosticsSettings";
import { KeybindingsSettingsPanel } from "./KeybindingsSettings";
import { McpSettingsPanel } from "./McpSettingsPanel";
import { SchedulesSettingsPanel } from "./SchedulesSettingsPanel";
import { SourceControlSettingsPanel } from "./SourceControlSettings";
import { UsageSettingsPanel } from "./UsageSettings";

export function SettingsSectionPanel({ sectionId }: { sectionId: SettingsSectionId }) {
  switch (sectionId) {
    case "general":
      return <GeneralSettingsPanel />;
    case "usage":
      return <UsageSettingsPanel />;
    case "keybindings":
      return <KeybindingsSettingsPanel />;
    case "providers":
      return <ProviderSettingsPanel />;
    case "source-control":
      return <SourceControlSettingsPanel />;
    case "connections":
      return <ConnectionsSettings />;
    case "archived":
      return <ArchivedThreadsPanel />;
    case "schedules":
      return <SchedulesSettingsPanel />;
    case "mcp":
      return <McpSettingsPanel />;
    case "cloud-agents":
      return <CloudAgentsSettingsPanel />;
    case "diagnostics":
      return <DiagnosticsSettingsPanel />;
    default: {
      const _exhaustive: never = sectionId;
      return _exhaustive;
    }
  }
}
