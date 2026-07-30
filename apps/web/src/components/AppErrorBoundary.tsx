import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "./ui/button";

interface AppErrorBoundaryProps {
  readonly children: ReactNode;
  readonly label?: string;
}

interface AppErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * Catches render-phase crashes (notably React error #185 "Maximum update
 * depth exceeded" thrown when an Effect atom subscription write-loops) and
 * renders a reload fallback instead of blanking the whole app window.
 *
 * Route-level `errorComponent`s only catch errors thrown during route load;
 * a write-loop blowup happens inside the rendered Outlet tree, so it needs a
 * real React error boundary around the rendered content.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary] render crash", this.props.label ?? "", error, info);
  }

  private handleReload = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isUpdateDepthLoop = /185|Maximum update depth/i.test(error.message);
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold">Trumbo Code hit a render error</h1>
          <p className="text-sm text-muted-foreground">
            {isUpdateDepthLoop
              ? "A background state update looped too many times. Reload to recover; if it keeps happening, sign out of Trumbo Connect and reload."
              : "The UI crashed while rendering. Reload to recover."}
          </p>
          <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
          <div className="flex justify-center gap-2 pt-2">
            <Button onClick={this.handleReload} size="sm">
              Reload
            </Button>
            <Button onClick={() => this.setState({ error: null })} variant="outline" size="sm">
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
