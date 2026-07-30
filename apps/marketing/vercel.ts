import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  installCommand: "npm install -g vite-plus && vp install --filter '@trumbo-code/marketing'",
  buildCommand: "vp run --filter @trumbo-code/marketing build",
  outputDirectory: "dist",
};
