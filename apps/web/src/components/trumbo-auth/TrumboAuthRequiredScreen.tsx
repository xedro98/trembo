import { CreditCardIcon, LogInIcon } from "lucide-react";
import { memo } from "react";

import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { TrumboWordmark } from "../TrumboWordmark";
import type { TrumboThreadAccessBlock } from "./trumboThreadAccess";
import { useTrumboModelAccess } from "./useTrumboModelAccess";

export const TrumboAuthRequiredScreen = memo(function TrumboAuthRequiredScreen({
  block,
}: {
  readonly block: Exclude<TrumboThreadAccessBlock, { kind: "none" }>;
}) {
  const { openAuthPrompt, openSubscribePrompt, authPrompt } = useTrumboModelAccess();
  const isSignIn = block.kind === "sign-in";

  return (
    <>
      <Empty className="min-h-0 flex-1 bg-background">
        <EmptyHeader className="max-w-md">
          <EmptyMedia variant="icon">
            <TrumboWordmark className="size-5 text-[#2BBF77]" />
          </EmptyMedia>
          <EmptyTitle className="text-foreground">
            {isSignIn ? "Sign in to Trumbo" : "Subscribe to Trumbo"}
          </EmptyTitle>
          <EmptyDescription className="mt-2 leading-relaxed text-muted-foreground/78">
            {isSignIn
              ? "Link this device to your Trumbo account to run threads with Quartz and Trumbo-supported models."
              : "Activate a Trumbo plan to unlock Quartz models and run threads in Trumbo Code."}
          </EmptyDescription>
        </EmptyHeader>
        <Button
          type="button"
          size="sm"
          className="mt-2"
          onClick={() => void (isSignIn ? openAuthPrompt() : openSubscribePrompt())}
        >
          {isSignIn ? (
            <>
              <LogInIcon className="size-4" />
              Sign in to Trumbo
            </>
          ) : (
            <>
              <CreditCardIcon className="size-4" />
              View plans
            </>
          )}
        </Button>
      </Empty>
      {authPrompt}
    </>
  );
});
