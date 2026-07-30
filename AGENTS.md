# AGENTS.md

## Task Completion Requirements

- `vp check` and `vp run typecheck` must pass before considering tasks completed.
  - If changing native mobile code, `vp run lint:mobile` must also pass.
- Use `vp test` for the built-in Vite+ test command and `vp run test` when you specifically need the `test` package script.

## Project Snapshot

Trumbo Code is a minimal web GUI for using coding agents like Codex and Claude.

This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Package Roles

- `apps/server`: Node.js WebSocket server. Wraps Codex app-server (JSON-RPC over stdio), serves the React web app, and manages provider sessions.
- `apps/web`: React/Vite UI. Owns session UX, conversation/event rendering, and client-side state. Connects to the server via WebSocket.
- `packages/contracts`: Shared effect/Schema schemas and TypeScript contracts for provider events, WebSocket protocol, and model/session types. Keep this package schema-only — no runtime logic.
- `packages/shared`: Shared runtime utilities consumed by both server and client applications. Uses explicit subpath exports (e.g. `@trumbo-code/shared/git`) — no barrel index.
- `packages/client-runtime`: Shared runtime package for sharing client code across web and mobile.

## Building & Shipping Desktop Apps

The desktop app is an Electron app (`apps/desktop`) bundled with the server
(`apps/server/dist`) and web client (`apps/server/dist/client`). Installers are
produced by `scripts/build-desktop-artifact.ts` via `vp run dist:desktop:artifact`.
Full reference: `docs/operations/desktop-builds.md`.

### Golden rules

1. **Never put `--` between the script and flags.** The Effect CLI treats `--`
   as end-of-options and silently drops every flag after it. Pass flags directly:
   `vp run dist:desktop:artifact --platform win --skip-build` (NOT `... -- --platform win`).
2. **The build script refuses cross-platform builds**
   (`UnsupportedCrossPlatformDesktopBuildError`). Match the host: Windows→win,
   macOS→mac, Linux→linux. From Windows, Linux builds run inside WSL Ubuntu.
3. **Reuse dist, don't rebuild.** Pass `--skip-build` to reuse existing
   `apps/desktop/dist-electron` + `apps/server/dist`. Rebuild first with
   `vp run build:desktop` only after code changes.
4. **Windows builds need the WSL node-pty prebuild** (`--wsl-prebuild`).
   node-pty ships no Linux prebuild; without it the WSL backend silently fails.
   Build it with `scripts/build-wsl-node-pty-local.sh` in WSL, then pass
   `--wsl-prebuild ./wsl-prebuild/pty.node`. A missing prebuild is a warning,
   not an error (Windows native backend still works).
5. **Unsigned builds trigger SmartScreen/Gatekeeper.** Signing needs
   `--signed` plus Azure Trusted Signing (Windows) or Apple CSC (macOS) env
   vars. See `scripts/setup-signing-env.sh` and `docs/operations/desktop-builds.md`.

### Quick commands (from the repo root)

```bash
# Build dist artifacts once (after code changes)
vp run build:desktop

# Windows x64 (local, with WSL backend)
vp run dist:desktop:artifact --platform win --target nsis --arch x64 --skip-build --wsl-prebuild ./wsl-prebuild/pty.node

# Linux x64 (from WSL Ubuntu; vp must be on WSL PATH)
vp run dist:desktop:artifact --platform linux --target AppImage --arch x64 --skip-build

# macOS (CI only — requires a Mac for sips/iconutil/signing)
# Trigger .github/workflows/build-macos.yml (standalone) or release.yml (full)
```

Artifacts land in `release/`. Outputs:
`Trumbo-Code-<version>-x64.exe`, `Trumbo-Code-<version>-x86_64.AppImage`,
`Trumbo-Code-<version>-arm64.dmg`.

### Shipping to GitHub

- Desktop app repo: `https://github.com/xedro98/trembo` (public, default `main`).
- **Push as an orphan commit** if the full history push fails with
  `remote unpack failed: index-pack failed` (a corrupted object in history):
  `git checkout --orphan ship && git add -A && git commit -m "..." && git push trembo ship:main --force`.
  This avoids the broken object without repairing the repo.
- Enable Actions after creating a new repo:
  `gh api -X PUT repos/xedro98/trembo/actions/permissions --input -` with
  `{"enabled":true,"allowed_actions":"all"}`.
- `wsl-prebuild/` and `.env*` are gitignored; never commit them.

### CI workflows

- `release.yml` — full release: all platforms, signing, relay config, CLI
  publish. Trigger via tag push `v*.*.*`, `workflow_dispatch`, or the nightly
  cron. Requires repo secrets (Azure, Apple, Cloudflare, Clerk).
- `build-macos.yml` — standalone macOS DMG, no gates. Use when you just need
  a macOS artifact without the full release pipeline.

### Identity / signing prerequisites (one-time)

- Legal entity: Maxfense, Inc. (Delaware, File #7070030, incorporated 2022-10-06).
- Azure Trusted Signing needs a D-U-N-S (D&B) or LEI (GLEIF) for identity
  validation — 3-7 business days. Maxfense has no LEI on GLEIF; check D&B for
  an existing D-U-N-S or request one at dnb.com/duns-number/get-a-duns.

## Reference Repos

- Open-source Codex repo: https://github.com/openai/codex
- Codex-Monitor (Tauri, feature-complete, strong reference implementation): https://github.com/Dimillian/CodexMonitor

Use these as implementation references when designing protocol handling, UX flows, and operational safeguards.

## Vendored Repositories

This project vendors external repositories under `.repos/` as read-only reference material for coding
agents.

- Prefer examples and patterns from the vendored source code over generated guesses or web search results.
- Do not edit files under `.repos/` unless explicitly asked.
- Do not import from `.repos/`; application code must continue importing from normal package dependencies.
- Manage vendored subtrees with `bun run sync:repos`; use `bun run sync:repos --repo <id>` to sync one
  configured repository.
- When updating a dependency with a configured vendored subtree, sync that subtree in the same change so
  `.repos/` matches the installed dependency version.
- When writing Effect code, read `.repos/effect-smol/LLMS.md` first and inspect `.repos/effect-smol/` for
  examples of idiomatic usage, tests, module structure, and API design.
- When writing relay infrastructure code with Alchemy, inspect `.repos/alchemy-effect/` for examples of
  idiomatic usage, tests, module structure, and API design.
