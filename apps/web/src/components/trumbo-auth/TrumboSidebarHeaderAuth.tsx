import { LogInIcon } from "lucide-react";
import { memo } from "react";

import { isNativeTrumboDesktop } from "../../lib/nativeTrumboDesktop";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { useTrumboModelAccess } from "./useTrumboModelAccess";
import { isTrumboSignedIn } from "./useTrumboAuthState";

export const TrumboSidebarHeaderAuth = memo(function TrumboSidebarHeaderAuth({
  className,
}: {
  readonly className?: string;
}) {
  const { authState, openAuthPrompt, authPrompt } = useTrumboModelAccess();

  if (!isNativeTrumboDesktop()) {
    return null;
  }

  if (isTrumboSignedIn(authState)) {
    return authPrompt;
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          "h-7 shrink-0 gap-1.5 px-2.5 font-stat text-xs font-medium text-muted-foreground transition-colors hover:text-brand hover:bg-transparent border-grid-line",
          className,
        )}
        onClick={() => void openAuthPrompt()}
      >
        <LogInIcon className="size-3.5" />
        Log in
      </Button>
      {authPrompt}
    </>
  );
});
