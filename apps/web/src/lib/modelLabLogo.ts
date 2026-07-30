const MODELS_DEV_LAB_LOGO = (labId: string) => `https://models.dev/logos/labs/${labId}.svg`;
const MODELS_DEV_PROVIDER_LOGO = (providerId: string) =>
  `https://models.dev/logos/${providerId}.svg`;

const LAB_PREFIX_RULES: ReadonlyArray<{
  readonly test: (modelId: string, modelName: string) => boolean;
  readonly labId: string;
}> = [
  {
    test: (id) => id === "quartz" || id.startsWith("quartz-") || id.startsWith("quartz/"),
    labId: "trumbo",
  },
  { test: (id, name) => /deepseek/i.test(id) || /deepseek/i.test(name), labId: "deepseek" },
  {
    test: (id, name) => /qwen|qwq|coder-qwen/i.test(id) || /qwen/i.test(name),
    labId: "alibaba",
  },
  {
    test: (id, name) => /llama|codellama|meta-llama/i.test(id) || /llama/i.test(name),
    labId: "meta",
  },
  {
    test: (id, name) => /mistral|mixtral|codestral|pixtral/i.test(id) || /mistral/i.test(name),
    labId: "mistral",
  },
  {
    test: (id, name) =>
      /^gpt-/i.test(id) ||
      /gpt-oss|chatgpt|o1-|o3-|o4-/i.test(id) ||
      /\bgpt\b/i.test(name) ||
      /openai/i.test(name),
    labId: "openai",
  },
  { test: (id, name) => /claude/i.test(id) || /claude|anthropic/i.test(name), labId: "anthropic" },
  {
    test: (id, name) => /gemini|gemma/i.test(id) || /gemini|gemma|google/i.test(name),
    labId: "google",
  },
  { test: (id, name) => /^phi-/i.test(id) || /phi-/i.test(name), labId: "microsoft" },
  {
    test: (id, name) => /glm|chatglm|zhipu/i.test(id) || /glm|zhipu/i.test(name),
    labId: "zhipuai",
  },
  {
    test: (id, name) => /kimi|moonshot/i.test(id) || /kimi|moonshot/i.test(name),
    labId: "moonshotai",
  },
  { test: (id, name) => /minimax/i.test(id) || /minimax/i.test(name), labId: "minimax" },
  { test: (id, name) => /^yi-/i.test(id) || /\byi\b/i.test(name), labId: "01-ai" },
  { test: (id, name) => /nemotron/i.test(id) || /nvidia/i.test(name), labId: "nvidia" },
  { test: (id, name) => /command-r|cohere/i.test(id) || /cohere/i.test(name), labId: "cohere" },
  { test: (id, name) => /grok/i.test(id) || /grok|xai/i.test(name), labId: "xai" },
  { test: (id, name) => /granite/i.test(id) || /ibm/i.test(name), labId: "ibm" },
  { test: (id, name) => /falcon/i.test(id) || /falcon/i.test(name), labId: "tii" },
  { test: (id, name) => /solar/i.test(id) || /upstage/i.test(name), labId: "upstage" },
  { test: (id, name) => /hermes/i.test(id) || /nous/i.test(name), labId: "nousresearch" },
  { test: (id, name) => /dbrx/i.test(id) || /databricks/i.test(name), labId: "databricks" },
  { test: (id, name) => /snowflake/i.test(id) || /snowflake/i.test(name), labId: "snowflake" },
  { test: (id, name) => /playground/i.test(id) || /playground/i.test(name), labId: "playground" },
];

/** Strip org/provider prefixes so `trumbo/claude-…` still resolves to anthropic. */
function modelIdentityCandidates(modelId: string, modelName: string): Array<[string, string]> {
  const id = modelId.trim().toLowerCase();
  const name = modelName.trim().toLowerCase();
  const candidates: Array<[string, string]> = [[id, name]];

  const slashParts = id.split("/").filter(Boolean);
  if (slashParts.length > 1) {
    const withoutFirst = slashParts.slice(1).join("/");
    candidates.push([withoutFirst, name]);
    candidates.push([slashParts[slashParts.length - 1]!, name]);
  }

  const colonParts = id.split(":").filter(Boolean);
  if (colonParts.length > 1) {
    candidates.push([colonParts[colonParts.length - 1]!, name]);
  }

  return candidates;
}

export function resolveModelLabId(modelId: string, modelName = ""): string {
  for (const [id, name] of modelIdentityCandidates(modelId, modelName)) {
    for (const rule of LAB_PREFIX_RULES) {
      if (rule.test(id, name)) {
        return rule.labId;
      }
    }
  }

  const id = modelId.trim().toLowerCase();
  const slashPrefix = id.split("/")[0]?.trim();
  // Never treat the Trumbo routing namespace as a lab — it wraps many labs.
  if (slashPrefix && slashPrefix !== id && slashPrefix !== "trumbo") {
    return slashPrefix;
  }

  return "fireworks-ai";
}

export function modelLabLogoUrl(labId: string): string {
  if (labId === "trumbo") {
    return "/trumbo-logo.svg";
  }
  return MODELS_DEV_LAB_LOGO(labId);
}

export function modelProviderLogoUrl(providerId: string): string {
  return MODELS_DEV_PROVIDER_LOGO(providerId);
}

export function resolveModelLogoUrls(
  modelId: string,
  modelName = "",
): {
  readonly labId: string;
  readonly primaryUrl: string;
  readonly fallbackUrl: string;
} {
  const labId = resolveModelLabId(modelId, modelName);
  return {
    labId,
    primaryUrl: modelLabLogoUrl(labId),
    fallbackUrl: modelProviderLogoUrl(labId),
  };
}
