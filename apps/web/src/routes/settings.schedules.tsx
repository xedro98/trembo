import { createFileRoute } from "@tanstack/react-router";

import { SchedulesSettingsPanel } from "../components/settings/SchedulesSettingsPanel";

function SettingsSchedulesRoute() {
  return <SchedulesSettingsPanel />;
}

export const Route = createFileRoute("/settings/schedules")({
  component: SettingsSchedulesRoute,
});
