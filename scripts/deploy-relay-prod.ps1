# Deploy Trumbo Connect relay (Alchemy prod stage) to Cloudflare.
# Requires infra/relay/.env plus infra/relay/.env.local with provider secrets.
# See infra/relay/.env.local.example

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$relayDir = Join-Path $repoRoot "infra\relay"
$envLocal = Join-Path $relayDir ".env.local"
$envExample = Join-Path $relayDir ".env.local.example"

if (-not (Test-Path $envLocal)) {
    Write-Host "Missing $envLocal"
    if (Test-Path $envExample) {
        Copy-Item $envExample $envLocal
        Write-Host "Created $envLocal from example. Fill in PlanetScale, Axiom, and APNs values, then rerun."
    }
    exit 1
}

$wranglerConfig = Join-Path $env:APPDATA "xdg.config\.wrangler\config\default.toml"
if (Test-Path $wranglerConfig) {
    $cfg = Get-Content $wranglerConfig -Raw
    if ($cfg -match 'oauth_token = "([^"]+)"') {
        $env:CLOUDFLARE_API_TOKEN = $Matches[1]
    }
}

$env:CLOUDFLARE_ACCOUNT_ID = "4494692921bf5584dfd071336b8f88bd"
$env:ALCHEMY_TELEMETRY_DISABLED = "1"
$env:CI = "true"

$required = @(
    "PLANETSCALE_ORGANIZATION",
    "PLANETSCALE_API_TOKEN_ID",
    "PLANETSCALE_API_TOKEN",
    "AXIOM_ORG_ID",
    "AXIOM_TOKEN",
    "APNS_ENVIRONMENT",
    "APNS_TEAM_ID",
    "APNS_KEY_ID",
    "APNS_BUNDLE_ID",
    "APNS_PRIVATE_KEY"
)

Get-Content $envLocal | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $name = $Matches[1]
        $value = $Matches[2].Trim().Trim('"')
        if ($value.Length -gt 0) {
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

$missing = @($required | Where-Object { -not (Get-Item "env:$_" -ErrorAction SilentlyContinue) })
if ($missing.Count -gt 0) {
    Write-Host "Missing required variables in .env.local:"
    $missing | ForEach-Object { Write-Host "  $_" }
    exit 1
}

Remove-Item -Recurse -Force "$env:USERPROFILE\.alchemy\lock" -ErrorAction SilentlyContinue

$env:PATH = "$env:APPDATA\npm;C:\Users\Admin\AppData\Local\pnpm;$env:PATH"
Push-Location $repoRoot
try {
    vp run --filter trumbo-code-relay deploy -- --stage prod --yes --env-file .env.local
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host ""
    Write-Host "Relay deployed. Set platform worker secret TRUMBO_RELAY_URL=https://relay.trumbo.dev"
    Write-Host "  cd D:\Torch\cline-full\projects\web"
    Write-Host "  wrangler secret put TRUMBO_RELAY_URL"
} finally {
    Pop-Location
}
