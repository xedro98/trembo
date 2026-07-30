// @effect-diagnostics nodeBuiltinImport:off

import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import { isWindowsHost } from "./testPlatform.ts";

export async function makeMockCliWrapper(input: {
  readonly dir: string;
  readonly name: string;
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly extraEnv?: Readonly<Record<string, string>>;
}): Promise<string> {
  const envEntries = Object.entries(input.extraEnv ?? {});
  if (isWindowsHost) {
    const wrapperPath = NodePath.join(input.dir, `${input.name}.cmd`);
    const envLines = envEntries.map(([key, value]) => `set "${key}=${value}"`);
    const commandLine = [
      input.command,
      ...input.args.map((arg) => `"${arg.replaceAll('"', '\\"')}"`),
    ].join(" ");
    const script = ["@echo off", ...envLines, `${commandLine} %*`].join("\r\n");
    await NodeFSP.writeFile(wrapperPath, script, "utf8");
    return wrapperPath;
  }

  const wrapperPath = NodePath.join(input.dir, `${input.name}.sh`);
  const envExports = envEntries
    .map(([key, value]) => `export ${key}=${JSON.stringify(value)}`)
    .join("\n");
  const commandLine = [input.command, ...input.args.map((arg) => JSON.stringify(arg)), '"$@"'].join(
    " ",
  );
  const script = `#!/bin/sh
${envExports}
exec ${commandLine}
`;
  await NodeFSP.writeFile(wrapperPath, script, "utf8");
  await NodeFSP.chmod(wrapperPath, 0o755);
  return wrapperPath;
}
