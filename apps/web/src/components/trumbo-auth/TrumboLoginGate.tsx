import { memo } from "react";

/**
 * Desktop auth gate placeholder. The app shell stays visible when signed out;
 * sign-in is offered from the sidebar header instead of a full-screen blocker.
 */
export const TrumboLoginGate = memo(function TrumboLoginGate({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <>{children}</>;
});
