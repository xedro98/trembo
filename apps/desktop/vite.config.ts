import { defineConfig } from "vite-plus";

import { loadRepoEnv } from "../../scripts/lib/public-config.ts";

const repoEnv = loadRepoEnv();
const shouldLaunchElectronAfterPack = process.env.TRUMBO_CODE_DESKTOP_DEV === "1";
const publicConfigDefine = {
  __TRUMBO_CODE_BUILD_PLATFORM_URL__: JSON.stringify(
    (process.env.TRUMBO_CODE_PLATFORM_URL ?? repoEnv.TRUMBO_CODE_PLATFORM_URL ?? "").trim() ||
      "https://platform.trumbo.dev",
  ),
  __TRUMBO_CODE_BUILD_OAUTH_CLIENT_ID__: JSON.stringify(
    (process.env.TRUMBO_CODE_OAUTH_CLIENT_ID ?? repoEnv.TRUMBO_CODE_OAUTH_CLIENT_ID ?? "").trim() ||
      "trumbo-code-desktop",
  ),
};

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "node scripts/build-preview-annotation-css.mjs && vp pack",
        dependsOn: ["trumbo-code#build"],
        cache: false,
      },
      dev: {
        command:
          "node scripts/build-preview-annotation-css.mjs && cross-env TRUMBO_CODE_DESKTOP_DEV=1 vp pack --watch",
        dependsOn: ["trumbo-code#build"],
        cache: false,
      },
      "dev:bundle": {
        command: "node scripts/build-preview-annotation-css.mjs && vp pack --watch",
        cache: false,
      },
      "dev:electron": {
        command: "node scripts/dev-electron.mjs",
        dependsOn: ["trumbo-code#build"],
        cache: false,
      },
    },
  },
  pack: [
    {
      format: "cjs",
      outDir: "dist-electron",
      sourcemap: true,
      outExtensions: () => ({ js: ".cjs" }),
      define: publicConfigDefine,
      entry: ["src/main.ts"],
      clean: true,
      deps: {
        alwaysBundle: (id) => id.startsWith("@trumbo-code/"),
      },
      ...(shouldLaunchElectronAfterPack ? { onSuccess: "node scripts/dev-electron.mjs" } : {}),
    },
    {
      format: "cjs",
      outDir: "dist-electron",
      sourcemap: true,
      outExtensions: () => ({ js: ".cjs" }),
      define: publicConfigDefine,
      entry: ["src/preload.ts"],
      deps: {
        alwaysBundle: (id) => id === "electron-store" || id.startsWith("electron-store/"),
      },
    },
    {
      format: "cjs",
      outDir: "dist-electron",
      sourcemap: true,
      outExtensions: () => ({ js: ".cjs" }),
      entry: ["src/preview-pick-preload.ts"],
      deps: {
        alwaysBundle: (id) => id === "react-grab" || id.startsWith("react-grab/"),
      },
    },
  ],
});
