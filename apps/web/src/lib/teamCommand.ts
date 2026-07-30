export const TEAM_COMMAND_USAGE =
  "Usage: /team <task description>\nStarts a team of agents for the given task.";

type TeamPromptRewriteResult =
  | { readonly kind: "none" }
  | { readonly kind: "usage" }
  | { readonly kind: "rewritten"; readonly prompt: string };

function formatUserCommandBlock(input: string, slash: string): string {
  return `<user_command slash="${slash}">${input}</user_command>`;
}

export function rewriteTeamPrompt(input: string): TeamPromptRewriteResult {
  const match = /^\/team\b([\s\S]*)$/i.exec(input.trim());
  if (!match) {
    return { kind: "none" };
  }
  const taskBody = match[1]?.trim() ?? "";
  if (!taskBody) {
    return { kind: "usage" };
  }
  return {
    kind: "rewritten",
    prompt: formatUserCommandBlock(
      `spawn a team of agents for the following task: ${taskBody}`,
      "team",
    ),
  };
}
