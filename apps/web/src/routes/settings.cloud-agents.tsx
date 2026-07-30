import { createFileRoute } from "@tanstack/react-router";

import { CloudAgentsSettingsPanel } from "../components/settings/CloudAgentsSettingsPanel";

function SettingsCloudAgentsRoute() {
  return <CloudAgentsSettingsPanel />;
}

export const Route = createFileRoute("/settings/cloud-agents")({
  component: SettingsCloudAgentsRoute,
});
