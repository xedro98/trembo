#!/usr/bin/env bash
# One-time helper: collect Azure Trusted Signing credentials and either write
# them to .env.local (for local signed builds) or push them as GitHub Actions
# secrets (for the release workflow). Run from the trumbo-code repo root.
#
#   ./scripts/setup-signing-env.sh local     # write .env.local
#   ./scripts/setup-signing-env.sh github   # gh secret set (requires a repo)
#
# The seven values come from the Azure portal / Entra ID app registration:
#   AZURE_TENANT_ID                            Entra tenant (Directory) ID
#   AZURE_CLIENT_ID                            App (client) ID of the service-principal app registration
#   AZURE_CLIENT_SECRET                        Client secret created on that app registration
#   AZURE_TRUSTED_SIGNING_ENDPOINT             e.g. https://eus2.codesigning.azure.net/
#   AZURE_TRUSTED_SIGNING_ACCOUNT_NAME         Trusted Signing account resource name
#   AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME  Certificate profile under the account
#   AZURE_TRUSTED_SIGNING_PUBLISHER_NAME       Validated publisher subject, e.g. "Maxfense, Inc"
set -euo pipefail

REQUIRED=(
  AZURE_TENANT_ID
  AZURE_CLIENT_ID
  AZURE_CLIENT_SECRET
  AZURE_TRUSTED_SIGNING_ENDPOINT
  AZURE_TRUSTED_SIGNING_ACCOUNT_NAME
  AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME
  AZURE_TRUSTED_SIGNING_PUBLISHER_NAME
)

mode="${1:-local}"
case "$mode" in
  local|github) ;;
  *) echo "usage: $0 [local|github]" >&2; exit 2 ;;
esac

missing=()
for v in "${REQUIRED[@]}"; do
  if [ -z "${!v:-}" ]; then missing+=("$v"); fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Missing required env vars:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  echo >&2
  echo "Export them first, e.g.:" >&2
  echo "  export AZURE_TENANT_ID=00000000-0000-0000-0000-000000000000" >&2
  echo "  export AZURE_CLIENT_ID=..." >&2
  echo "  export AZURE_CLIENT_SECRET=..." >&2
  echo "  export AZURE_TRUSTED_SIGNING_ENDPOINT=https://eus2.codesigning.azure.net/" >&2
  echo "  export AZURE_TRUSTED_SIGNING_ACCOUNT_NAME=trumbo-code-signing" >&2
  echo "  export AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME=TrumboCode" >&2
  echo "  export AZURE_TRUSTED_SIGNING_PUBLISHER_NAME='Maxfense, Inc'" >&2
  exit 1
fi

if [ "$mode" = "local" ]; then
  root="$(git rev-parse --show-toplevel)"
  out="$root/.env.local"
  if [ -f "$out" ] && ! grep -q "AZURE_TRUSTED_SIGNING_ACCOUNT_NAME" "$out"; then
    echo "" >> "$out"
  fi
  {
    echo "# Azure Trusted Signing - added by scripts/setup-signing-env.sh"
    for v in "${REQUIRED[@]}"; do
      printf '%s=%s\n' "$v" "${!v}"
    done
  } >> "$out"
  echo "Wrote 7 signing vars to $out"
  echo "Now run:  vp run dist:desktop:win -- --skip-build --signed --verbose"
  echo "(.env.local is gitignored; do not commit it.)"
  exit 0
fi

# github mode
if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not installed" >&2; exit 1
fi
repo="${GH_REPO:-xedro98/trumbo-code}"
echo "Setting GitHub secrets on $repo ..."
for v in "${REQUIRED[@]}"; do
  printf '%s' "${!v}" | gh secret set "$v" --repo "$repo"
  echo "  set $v"
done
echo "Done. Trigger a release (tag v*.*.* or workflow_dispatch) and release.yml will sign Windows builds."
