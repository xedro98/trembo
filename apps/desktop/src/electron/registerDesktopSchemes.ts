import * as Electron from "electron";

import { DESKTOP_DEVELOPMENT_SCHEME, DESKTOP_PRODUCTION_SCHEME } from "./ElectronProtocol.ts";

/**
 * Must run before `app.whenReady()` so Electron treats the desktop custom
 * protocols as standard, CORS-capable origins instead of opaque `null` origins.
 * Without this, Vite-built module scripts (`crossorigin`) fail to load from
 * `trumbo-code://app/` even when proxied from the local backend.
 */
export function registerDesktopSchemes(): void {
  Electron.protocol.registerSchemesAsPrivileged([
    {
      scheme: DESKTOP_PRODUCTION_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
    {
      scheme: DESKTOP_DEVELOPMENT_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

registerDesktopSchemes();
