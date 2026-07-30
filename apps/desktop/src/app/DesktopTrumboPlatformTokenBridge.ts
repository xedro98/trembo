// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

export const TRUMBO_PLATFORM_TOKEN_SECRET = "trumbo-platform-token";

export interface TrumboPlatformTokenSession {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAtEpochMs: number;
}

export function syncTrumboPlatformToken(
  secretsDir: string,
  session: TrumboPlatformTokenSession | null | undefined,
): void {
  NodeFS.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
  const secretPath = NodePath.join(secretsDir, `${TRUMBO_PLATFORM_TOKEN_SECRET}.bin`);

  if (!session?.accessToken?.trim()) {
    try {
      NodeFS.unlinkSync(secretPath);
    } catch {
      // ignore missing secret
    }
    return;
  }

  const payload = JSON.stringify({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken ?? "",
    expiresAtEpochMs: session.expiresAtEpochMs,
  });
  const tempPath = `${secretPath}.${process.pid}.tmp`;
  NodeFS.writeFileSync(tempPath, payload, { encoding: "utf8", mode: 0o600 });
  NodeFS.renameSync(tempPath, secretPath);
}

export function clearTrumboPlatformToken(secretsDir: string): void {
  syncTrumboPlatformToken(secretsDir, null);
}

export function resolveDesktopSecretsDir(stateDir: string): string {
  return NodePath.join(stateDir, "secrets");
}
