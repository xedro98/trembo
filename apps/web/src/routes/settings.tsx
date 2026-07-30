import { createFileRoute, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { settingsSectionIdFromPath } from "../components/settings/settingsNavItems";
import { openSettingsModal } from "../settingsModalBus";

function SettingsDeepLinkHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const section = settingsSectionIdFromPath(location.pathname) ?? "general";
    openSettingsModal(section);
    void navigate({ to: "/", replace: true });
  }, [location.pathname, navigate]);

  return null;
}

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }
  },
  component: SettingsDeepLinkHandler,
});
