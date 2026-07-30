// @effect-diagnostics nodeBuiltinImport:off globalTimers:off preferSchemaOverJson:off

import * as NodeCrypto from "node:crypto";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as PlatformError from "effect/PlatformError";

import * as Layer from "effect/Layer";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Scope from "effect/Scope";

import { HostProcessPlatform } from "@trumbo-code/shared/hostProcess";

export const NonWindowsPlatform = Layer.succeed(HostProcessPlatform, "linux");

export function normalizeTestSpawnArgs(args: ReadonlyArray<string>): ReadonlyArray<string> {
  return args.map((arg) => {
    let normalized = arg
      .replace(/^\^"/, '"')
      .replace(/"\^$/, '"')
      .replace(/\^"/g, '"')
      .replace(/^\^/, "")
      .replace(/\^$/, "");
    if (normalized.startsWith('"') && normalized.endsWith('"')) {
      normalized = normalized.slice(1, -1);
    }
    return normalized;
  });
}

export function normalizeTestPath(value: string): string {
  return value.replaceAll("\\", "/");
}

export function expectPathEndsWith(value: string, suffix: string): boolean {
  return normalizeTestPath(value).endsWith(normalizeTestPath(suffix));
}

export function expectPathContains(value: string, fragment: string): boolean {
  return normalizeTestPath(value).includes(normalizeTestPath(fragment));
}

export const isWindowsHost = Effect.runSync(HostProcessPlatform) === "win32";

export function skipOnWindows(reason: string): Effect.Effect<void> {
  return isWindowsHost ? Effect.die(new Error(`skipped on Windows: ${reason}`)) : Effect.void;
}

export function exitLogShowsProcessStop(exitLog: string): boolean {
  return /SIGTERM|SIGINT|stdin-(?:end|close)|exit:\d+/.test(exitLog);
}

export function countExitLogStopSignals(exitLog: string): number {
  return exitLog.match(/SIGTERM|SIGINT|stdin-(?:end|close)|exit:\d+/g)?.length ?? 0;
}

export async function waitForProcessExit(pid: number, attempts = 120): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let running = false;
    try {
      process.kill(pid, 0);
      running = true;
    } catch {
      running = false;
    }
    if (!running) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for process ${pid} to exit`);
}

export async function readPidLogEntries(
  filePath: string,
  minCount = 1,
  attempts = 120,
): Promise<ReadonlyArray<number>> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const raw = await NodeFSP.readFile(filePath, "utf8");
      const pids = raw
        .split("\n")
        .map((line) => Number.parseInt(line.trim(), 10))
        .filter((pid) => Number.isFinite(pid) && pid > 0);
      if (pids.length >= minCount) {
        return pids;
      }
    } catch {
      // keep polling until the mock agent writes its pid
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${minCount} pid log entries at ${filePath}`);
}

export async function readPidLog(filePath: string, attempts = 120): Promise<number> {
  const pids = await readPidLogEntries(filePath, 1, attempts);
  return pids[pids.length - 1]!;
}

async function waitForFileContent(filePath: string, attempts = 120): Promise<string> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await NodeFSP.readFile(filePath, "utf8");
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error(`Timed out waiting for file content at ${filePath}`);
}

export async function assertAcpChildProcessStopped(input: {
  readonly exitLogPath: string;
  readonly pidLogPath: string;
  readonly minPidCount?: number;
}): Promise<void> {
  const minPidCount = input.minPidCount ?? 1;
  if (isWindowsHost) {
    const pids = await readPidLogEntries(input.pidLogPath, minPidCount);
    for (const pid of pids) {
      await waitForProcessExit(pid);
    }
    return;
  }
  const exitLog = await waitForFileContent(input.exitLogPath);
  if (!exitLogShowsProcessStop(exitLog)) {
    throw new Error(`ACP child did not report a graceful stop: ${exitLog}`);
  }
}

export async function assertAcpExitLogStopCount(
  exitLogPath: string,
  minCount: number,
): Promise<void> {
  const exitLog = await waitForFileContent(exitLogPath);
  if (countExitLogStopSignals(exitLog) < minCount) {
    throw new Error(`Expected at least ${minCount} ACP stop signals, got: ${exitLog}`);
  }
}

export function withGitCeilingDirectory<A>(dir: string, run: () => A): A {
  const previous = process.env.GIT_CEILING_DIRECTORIES;
  process.env.GIT_CEILING_DIRECTORIES = dir;
  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env.GIT_CEILING_DIRECTORIES;
    } else {
      process.env.GIT_CEILING_DIRECTORIES = previous;
    }
  }
}

/** Stop git from discovering repos above the host temp directory (e.g. `C:/.git` on Windows). */
export function isolatedGitCeilingDirectory(): string {
  return NodePath.resolve(NodeOS.tmpdir()).replace(/\\/g, "/");
}

export function normalizeArgvToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function normalizeArgvLogTokens(tokens: ReadonlyArray<string>): ReadonlyArray<string> {
  return tokens.map(normalizeArgvToken);
}

export function makeHostTempDirectoryScoped(
  prefix: string,
): Effect.Effect<
  string,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path | Scope.Scope
> {
  return Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dir = path.join(NodeOS.tmpdir(), `${prefix}${NodeCrypto.randomUUID()}`);
    yield* fileSystem.makeDirectory(dir, { recursive: true });
    yield* Effect.addFinalizer(() =>
      fileSystem.remove(dir, { recursive: true, force: true }).pipe(Effect.orDie),
    );
    return dir;
  });
}

export function spawnArgsInclude(args: ReadonlyArray<string>, expected: string): boolean {
  const normalized = normalizeTestSpawnArgs(args);
  return normalized.includes(expected) || normalized.join(" ") === expected;
}

export function spawnArgsKey(args: ReadonlyArray<string>): string {
  return normalizeTestSpawnArgs(args).join(" ");
}

export function spawnArgsIncludeVersion(args: ReadonlyArray<string>): boolean {
  return spawnArgsInclude(args, "--version");
}

export function spawnArgsIncludeAuthStatus(args: ReadonlyArray<string>): boolean {
  const normalized = normalizeTestSpawnArgs(args);
  const joined = normalized.join(" ");
  return (
    joined.includes("auth status") || (normalized.includes("auth") && normalized.includes("status"))
  );
}
