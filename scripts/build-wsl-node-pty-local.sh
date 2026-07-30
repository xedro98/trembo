#!/usr/bin/env bash
# Build the Linux x64 node-pty prebuild for the Windows installer's WSL backend.
# Run inside WSL Ubuntu:  wsl -d Ubuntu -- bash /mnt/.../scripts/build-wsl-node-pty-local.sh
# Requires: Node 22+, build-essential, python3 (npx/node-gyp pulled automatically).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
PTY_DIR="$(find "$REPO/node_modules/.pnpm" -maxdepth 3 -type d -name "node-pty" -path "*node-pty@*" 2>/dev/null | head -1)"
echo "repo: $REPO"
echo "pty_dir: $PTY_DIR"
if [ -z "$PTY_DIR" ]; then echo "node-pty not found"; exit 1; fi
cd "$PTY_DIR"
echo "--- node-pty version: $(node -p "require('./package.json').version") ---"
npx --yes node-gyp rebuild 2>&1 | tail -15
echo "--- built pty.node ---"
ls -la build/Release/pty.node
file build/Release/pty.node
# Copy into the repo's wsl-prebuild dir (visible to Windows side)
mkdir -p "$REPO/wsl-prebuild"
cp build/Release/pty.node "$REPO/wsl-prebuild/pty.node"
echo "--- staged ---"
ls -la "$REPO/wsl-prebuild/pty.node"
