import { isElectron } from "../env";

const NATIVE_DESKTOP_PROTOCOLS = new Set(["trumbo-code:", "trumbo-dev:", "trumbo:"]);

/** True when running inside the packaged/dev Electron shell with Trumbo account auth. */
export function isNativeTrumboDesktop(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (isElectron) {
    return true;
  }

  const bridge = (window as unknown as { desktopBridge?: { trumboAuth?: unknown } }).desktopBridge;
  if (bridge?.trumboAuth) {
    return true;
  }

  // Packaged desktop serves the UI from a custom protocol even before auth hydrates.
  return NATIVE_DESKTOP_PROTOCOLS.has(window.location.protocol);
}
