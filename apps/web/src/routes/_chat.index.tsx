import { createFileRoute } from "@tanstack/react-router";
import { openSettingsModal } from "../settingsModalBus";
import { LinkIcon, PlusIcon } from "lucide-react";

import { AppMain } from "../components/AppMain";
import { NoActiveThreadState } from "../components/NoActiveThreadState";
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { useEnvironments } from "../state/environments";
import { hasCloudPublicConfig } from "~/cloud/publicConfig";

function ChatIndexRouteView() {
  const { authGateState } = Route.useRouteContext();
  const { environments } = useEnvironments();

  if (authGateState.status === "hosted-static" && environments.length === 0) {
    return (
      <AppMain>
        <HostedStaticOnboardingState />
      </AppMain>
    );
  }

  return <NoActiveThreadState />;
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});

function HostedStaticOnboardingState() {
  const cloudEnabled = hasCloudPublicConfig();

  return (
    <Empty className="flex-1">
      <div className="w-full max-w-xl rounded-3xl border border-border/55 bg-card/20 px-8 py-12 shadow-sm/5">
        <EmptyHeader className="max-w-none">
          <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground">
            <LinkIcon className="size-5" />
          </div>
          <EmptyTitle className="text-foreground text-xl">
            Connect an environment to get started
          </EmptyTitle>
          <EmptyDescription className="mt-2 text-sm leading-relaxed text-muted-foreground/78">
            {cloudEnabled
              ? "Sign in to Trumbo Connect to connect a linked environment through its managed tunnel, or add a reachable backend manually."
              : "Add a reachable backend manually to start working from this browser."}
          </EmptyDescription>
          <div className="mt-6 flex justify-center">
            <Button size="sm" onClick={() => openSettingsModal("connections")}>
              <PlusIcon className="size-4" />
              {cloudEnabled ? "Open Connections" : "Add environment"}
            </Button>
          </div>
        </EmptyHeader>
      </div>
    </Empty>
  );
}
