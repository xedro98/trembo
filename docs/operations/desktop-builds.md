# Desktop Builds

Trumbo Code desktop installers are built with `scripts/build-desktop-artifact.ts`
via the `vp run dist:desktop:artifact` command. The repo's `package.json`
exposes convenience scripts per platform:

| Script                     | Platform | Target   | Arch      |
| -------------------------- | -------- | -------- | --------- |
| `dist:desktop:win`         | Windows  | nsis     | x64       |
| `dist:desktop:win:arm64`   | Windows  | nsis     | arm64     |
| `dist:desktop:win:x64`     | Windows  | nsis     | x64       |
| `dist:desktop:dmg`         | macOS    | dmg      | host arch |
| `dist:desktop:dmg:arm64`   | macOS    | dmg      | arm64     |
| `dist:desktop:dmg:x64`     | macOS    | dmg      | x64       |
| `dist:desktop:linux`       | Linux    | AppImage | x64       |
| `dist:desktop:linux:arm64` | Linux    | AppImage | arm64     |

> **Important:** do NOT put `--` between the script name and the flags. The
> Effect CLI parser treats `--` as "end of options", silently dropping every
> flag after it. Pass flags directly:
>
> ```bash
> # WRONG: flags silently ignored, build runs full pipeline
> vp run dist:desktop:artifact -- --platform win --skip-build
>
> # RIGHT: flags parsed correctly
> vp run dist:desktop:artifact --platform win --target nsis --arch x64 --skip-build
> ```

## Prerequisites

The desktop build reuses pre-built artifacts from `apps/desktop/dist-electron`
and `apps/server/dist`. Build them first (once, or after code changes):

```bash
vp run build:desktop
```

Pass `--skip-build` to the artifact command to reuse existing dist output.

## Windows (from Windows)

```bash
vp run dist:desktop:artifact --platform win --target nsis --arch x64 --skip-build
```

Output: `release/Trumbo-Code-<version>-x64.exe`

### WSL backend prebuild (Windows builds only)

node-pty 1.1.0 ships prebuilds for `darwin-*` and `win32-*` but **not Linux**.
The Windows installer bundles a WSL backend that runs under the distro's own
Linux Node, which cannot load the Windows pty binary. Without a Linux prebuild
the WSL backend won't start on the user's machine.

The CI `release.yml` builds the Linux pty.node on a Linux runner and passes it
via `--wsl-prebuild`. To do the same locally, build it in WSL and pass the path:

```bash
# 1. Build the Linux x64 prebuild in WSL (requires Node 22+ in WSL Ubuntu)
wsl -d Ubuntu -- bash /mnt/d/Torch/cline-full/projects/trumbo-code/scripts/build-wsl-node-pty-local.sh

# 2. Build the Windows installer with the prebuild
vp run dist:desktop:artifact --platform win --target nsis --arch x64 --skip-build \
  --wsl-prebuild ./wsl-prebuild/pty.node
```

The staged binary lands at
`node_modules/node-pty/prebuilds/linux-x64/pty.node` inside the packaged app,
alongside a `trumbo-code-wsl-node-pty.json` marker. A missing prebuild is a
warning, not an error: the Windows native backend still works, only the WSL
backend is affected.

## Linux (from WSL Ubuntu)

The build script refuses cross-platform builds
(`UnsupportedCrossPlatformDesktopBuildError`), so a Linux AppImage must be
built on Linux. From a Windows machine, use WSL Ubuntu:

```bash
# One-time WSL setup (if Node/vite-plus aren't installed yet):
wsl -d Ubuntu -- bash -lc '
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs build-essential python3
  curl -fsSL https://vite.plus | bash
  corepack enable && corepack prepare pnpm@11.10.0 --activate
'

# Build (reuses the Windows-side dist artifacts via /mnt/d):
wsl -d Ubuntu -- bash -lc '
  export PATH="/root/.vite-plus/bin:$PATH"
  cd /mnt/d/Torch/cline-full/projects/trumbo-code
  vp run dist:desktop:artifact --platform linux --target AppImage --arch x64 --skip-build
'
```

Output: `release/Trumbo-Code-<version>-x86_64.AppImage`

## macOS

macOS DMGs can only be built on macOS (`sips`, `iconutil`, Apple code signing).
There is no local workaround from Windows/Linux. Use the CI `release.yml`
workflow (macOS runner) or a Mac.

## Signing

Unsigned builds trigger SmartScreen on Windows and Gatekeeper warnings on
macOS. For signed builds:

- **Windows**: `--signed` with Azure Trusted Signing. Requires the seven
  `AZURE_TRUSTED_SIGNING_*` / `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` /
  `AZURE_CLIENT_SECRET` env vars. Use `scripts/setup-signing-env.sh` to write
  them to `.env.local` (local) or GitHub secrets (CI).
- **macOS**: `--signed` with `CSC_LINK` / `CSC_KEY_PASSWORD` /
  `APPLE_API_KEY` / `APPLE_API_KEY_ID` / `APPLE_API_ISSUER` +
  `TRUMBO_CODE_APPLE_TEAM_ID` / `TRUMBO_CODE_MACOS_PROVISIONING_PROFILE`.

See `.github/workflows/release.yml` for the full CI signing matrix.

## CI (all platforms)

The `release.yml` workflow builds all platforms on dedicated runners and is
the canonical release path. Trigger via:

- Tag push `v*.*.*` (stable) or `v*-nightly.*` (nightly)
- `workflow_dispatch` with channel `stable` or `nightly`
- The 3-hourly scheduled nightly cron (skips if no new commits)
