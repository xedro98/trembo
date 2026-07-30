// @effect-diagnostics nodeBuiltinImport:off globalTimers:off preferSchemaOverJson:off

import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { PlatformEcosystemError } from "@trumbo-code/contracts";
import {
  mergePathValues,
  resolveKnownWindowsCliDirs,
  resolveSpawnCommand,
} from "@trumbo-code/shared/shell";
import * as Effect from "effect/Effect";

import { resolveTrumboCliDevCwd } from "../provider/acp/TrumboCliAcpSupport.ts";
import { HostProcessPlatform } from "@trumbo-code/shared/hostProcess";

const isWindowsHost = Effect.runSync(HostProcessPlatform) === "win32";

export interface TrumboCliRunnerOptions {
  readonly binaryPath?: string | undefined;
  readonly cliCwd?: string | undefined;
  readonly environment?: NodeJS.ProcessEnv | undefined;
  readonly cwd?: string | undefined;
}

function readEnvPath(env: NodeJS.ProcessEnv): string | undefined {
  return env.PATH ?? env.Path ?? env.path;
}

function resolveBunBinary(): string {
  const home = NodeOS.homedir();
  const exe = isWindowsHost ? "bun.exe" : "bun";
  const candidate = NodePath.join(home, ".bun", "bin", exe);
  if (NodeFS.existsSync(candidate)) {
    return candidate;
  }
  return "bun";
}

function augmentEnvForCliSpawn(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (!isWindowsHost) {
    return env;
  }

  const knownCliPath = resolveKnownWindowsCliDirs(env).join(";");
  const mergedPath = mergePathValues(knownCliPath, readEnvPath(env), "win32");
  return mergedPath ? { ...env, PATH: mergedPath } : env;
}

function resolveTrumboSpawn(input: TrumboCliRunnerOptions): {
  command: string;
  argsPrefix: ReadonlyArray<string>;
  cwd?: string;
} {
  const configuredBinary = input.binaryPath?.trim();
  if (configuredBinary) {
    return { command: configuredBinary, argsPrefix: [] };
  }

  const devCwd = input.cliCwd?.trim() || resolveTrumboCliDevCwd(input.environment);
  if (devCwd) {
    return {
      command: resolveBunBinary(),
      argsPrefix: ["run", "src/index.ts"],
      cwd: devCwd,
    };
  }

  return {
    command: "trumbo",
    argsPrefix: [],
  };
}

function runProcess(
  command: string,
  args: ReadonlyArray<string>,
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    shell?: boolean;
  },
): Effect.Effect<{ stdout: string; stderr: string; exitCode: number }, PlatformEcosystemError> {
  return Effect.callback((resume) => {
    const child = NodeChildProcess.spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      ...(options.shell ? { shell: true } : {}),
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (
      effect: Effect.Effect<
        { stdout: string; stderr: string; exitCode: number },
        PlatformEcosystemError
      >,
    ) => {
      if (settled) {
        return;
      }
      settled = true;
      resume(effect);
    };

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      finish(
        Effect.fail(
          new PlatformEcosystemError({
            operation: "trumbo.cli.spawn",
            message: error.message,
          }),
        ),
      );
    });
    child.on("close", (exitCode) => {
      finish(
        Effect.succeed({
          stdout,
          stderr,
          exitCode: exitCode ?? 1,
        }),
      );
    });

    return Effect.sync(() => {
      if (!child.killed) {
        child.kill();
      }
    });
  });
}

export function runTrumboCliJson(
  subcommandArgs: ReadonlyArray<string>,
  options: TrumboCliRunnerOptions,
): Effect.Effect<unknown, PlatformEcosystemError> {
  return Effect.gen(function* () {
    const spawn = resolveTrumboSpawn(options);
    const args = [...spawn.argsPrefix, ...subcommandArgs, "--json"];
    const env = augmentEnvForCliSpawn({
      ...process.env,
      ...options.environment,
    });
    const resolved = yield* resolveSpawnCommand(spawn.command, args, {
      env,
      extendEnv: true,
    });
    const result = yield* runProcess(resolved.command, resolved.args, {
      ...(spawn.cwd ? { cwd: spawn.cwd } : {}),
      ...(options.cwd ? { cwd: options.cwd } : {}),
      env,
      shell: resolved.shell,
    });

    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
      return yield* Effect.fail(
        new PlatformEcosystemError({
          operation: "trumbo.cli",
          message: detail,
        }),
      );
    }

    const trimmed = result.stdout.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return yield* Effect.fail(
        new PlatformEcosystemError({
          operation: "trumbo.cli.parse",
          message: "Trumbo CLI returned invalid JSON.",
        }),
      );
    }
  });
}

export function resolveDefaultMcpSettingsPath(): string {
  const fromEnv = process.env.TRUMBO_MCP_SETTINGS_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const home = NodeOS.homedir();
  return NodePath.join(home, ".trumbo", "data", "settings", "trumbo_mcp_settings.json");
}
