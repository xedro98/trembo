// @effect-diagnostics nodeBuiltinImport:off

import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import { isWindowsHost } from "./testPlatform.ts";

export async function writeNodeCliExecutable(input: {
  readonly dir: string;
  readonly name: string;
  readonly script: string;
}): Promise<string> {
  const scriptPath = NodePath.join(input.dir, `${input.name}.mjs`);
  await NodeFSP.writeFile(scriptPath, input.script, "utf8");

  if (isWindowsHost) {
    const wrapperPath = NodePath.join(input.dir, `${input.name}.cmd`);
    const script = `@echo off\r\n"${process.execPath}" "${scriptPath}" %*\r\n`;
    await NodeFSP.writeFile(wrapperPath, script, "utf8");
    return wrapperPath;
  }

  const wrapperPath = NodePath.join(input.dir, input.name);
  await NodeFSP.writeFile(wrapperPath, `#!/usr/bin/env node\n${input.script}`, "utf8");
  await NodeFSP.chmod(wrapperPath, 0o755);
  return wrapperPath;
}

export type FakeCodexBinaryOptions = {
  readonly output: string;
  readonly exitCode?: number;
  readonly stderr?: string;
  readonly requireImage?: boolean;
  readonly requireServiceTier?: string;
  readonly requireReasoningEffort?: string;
  readonly forbidReasoningEffort?: boolean;
  readonly stdinMustContain?: string;
  readonly stdinMustNotContain?: string;
};

export function buildFakeCodexNodeScript(input: FakeCodexBinaryOptions): string {
  return `
import * as NodeFS from "node:fs";

const args = process.argv.slice(2);
let outputPath = "";
let seenImage = false;
let seenServiceTier = "";
let seenReasoningEffort = "";

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--image") {
    if (args[index + 1]) {
      seenImage = true;
    }
    index += 1;
    continue;
  }
  if (arg === "--config") {
    const value = args[index + 1] ?? "";
    if (value.startsWith("service_tier=")) {
      seenServiceTier = value;
    }
    if (value.startsWith("model_reasoning_effort=")) {
      seenReasoningEffort = value;
    }
    index += 1;
    continue;
  }
  if (arg === "--output-last-message") {
    outputPath = args[index + 1] ?? "";
    index += 1;
  }
}

const stdinContent = NodeFS.readFileSync(0, "utf8");

function fail(message, code) {
  process.stderr.write(String(message) + "\\n");
  process.exit(code);
}

${input.requireImage ? `if (!seenImage) fail("missing --image input", 2);` : ""}
${
  input.requireServiceTier
    ? `if (seenServiceTier !== ${JSON.stringify(`service_tier="${input.requireServiceTier}"`)}) fail("unexpected service tier config: " + seenServiceTier, 5);`
    : ""
}
${
  input.requireReasoningEffort !== undefined
    ? `if (seenReasoningEffort !== ${JSON.stringify(`model_reasoning_effort="${input.requireReasoningEffort}"`)}) fail("unexpected reasoning effort config: " + seenReasoningEffort, 6);`
    : ""
}
${input.forbidReasoningEffort ? `if (seenReasoningEffort) fail("reasoning effort config should be omitted: " + seenReasoningEffort, 7);` : ""}
${
  input.stdinMustContain !== undefined
    ? `if (!stdinContent.includes(${JSON.stringify(input.stdinMustContain)})) fail("stdin missing expected content", 3);`
    : ""
}
${
  input.stdinMustNotContain !== undefined
    ? `if (stdinContent.includes(${JSON.stringify(input.stdinMustNotContain)})) fail("stdin contained forbidden content", 4);`
    : ""
}
${input.stderr !== undefined ? `process.stderr.write(${JSON.stringify(input.stderr)} + "\\n");` : ""}
if (outputPath) {
  NodeFS.writeFileSync(outputPath, ${JSON.stringify(input.output)});
}
process.exit(${input.exitCode ?? 0});
`.trimStart();
}

export async function writeFakeShellCliExecutable(input: {
  readonly dir: string;
  readonly name: string;
  readonly lines: ReadonlyArray<string>;
}): Promise<string> {
  if (isWindowsHost) {
    return writeNodeCliExecutable({
      dir: input.dir,
      name: input.name,
      script: `process.stderr.write("fake shell wrapper is not portable: ${input.name}\\n");\nprocess.exit(1);\n`,
    });
  }

  const wrapperPath = NodePath.join(input.dir, input.name);
  await NodeFSP.writeFile(wrapperPath, input.lines.join("\n"), "utf8");
  await NodeFSP.chmod(wrapperPath, 0o755);
  return wrapperPath;
}

export async function writeFakeVersionCliExecutable(input: {
  readonly dir: string;
  readonly name: string;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
}): Promise<string> {
  return writeNodeCliExecutable({
    dir: input.dir,
    name: input.name,
    script: `
${input.stderr ? `process.stderr.write(${JSON.stringify(input.stderr)} + "\\n");` : ""}
${input.stdout ? `process.stdout.write(${JSON.stringify(input.stdout)});` : ""}
process.exit(${input.exitCode ?? 0});
`.trimStart(),
  });
}
