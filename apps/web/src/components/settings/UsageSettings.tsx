import { BarChart3Icon } from "lucide-react";

import { isNativeTrumboDesktop } from "../../lib/nativeTrumboDesktop";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";
import { TrumboPlanUsagePanel } from "../trumbo-auth/TrumboPlanUsage";
import { useTrumboConnectAuthPrompt } from "../trumbo-auth/useTrumboConnectAuthPrompt";
import { useTrumboAuthState } from "../trumbo-auth/useTrumboAuthState";
import { Button } from "../ui/button";

function UsageSignInPrompt() {
  const { authPrompt, openAuthPrompt } = useTrumboConnectAuthPrompt();

  return (
    <>
      <SettingsSection title="Subscription" icon={<BarChart3Icon className="size-3.5" />}>
        <SettingsRow
          title="Trumbo plan usage"
          description="Sign in to your Trumbo account to view request limits and renewal details."
          control={
            <Button size="sm" variant="outline" onClick={() => void openAuthPrompt()}>
              Sign in
            </Button>
          }
        />
      </SettingsSection>
      {authPrompt}
    </>
  );
}

function UsageUnavailableOnWeb() {
  return (
    <SettingsPageContainer>
      <SettingsSection title="Subscription" icon={<BarChart3Icon className="size-3.5" />}>
        <SettingsRow
          title="Trumbo plan usage"
          description="Request usage and plan limits are available in the Trumbo desktop app."
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}

export function UsageSettingsPanel() {
  const state = useTrumboAuthState();

  if (!isNativeTrumboDesktop()) {
    return <UsageUnavailableOnWeb />;
  }

  if (!state || state.status !== "signed-in") {
    return (
      <SettingsPageContainer>
        <UsageSignInPrompt />
      </SettingsPageContainer>
    );
  }

  return (
    <SettingsPageContainer>
      <TrumboPlanUsagePanel />
    </SettingsPageContainer>
  );
}
