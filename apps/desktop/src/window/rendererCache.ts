// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import * as Electron from "electron";

const RENDERER_CACHE_VERSION_FILE = "renderer-cache-version.txt";

export async function clearRendererCacheIfVersionChanged(appVersion: string): Promise<void> {
  const markerPath = NodePath.join(Electron.app.getPath("userData"), RENDERER_CACHE_VERSION_FILE);

  let previousVersion = "";
  try {
    previousVersion = NodeFS.readFileSync(markerPath, "utf8").trim();
  } catch {
    previousVersion = "";
  }

  if (previousVersion === appVersion) {
    return;
  }

  await Electron.session.defaultSession.clearCache();
  NodeFS.writeFileSync(markerPath, appVersion, "utf8");
}
