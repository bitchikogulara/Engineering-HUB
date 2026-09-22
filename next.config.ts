import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prompt files are read from disk at runtime (spec: prompts live in
  // /ai/prompts/*.md, never inline) — make sure Vercel's file tracing
  // bundles them with the serverless functions.
  outputFileTracingIncludes: {
    "/**": ["./ai/prompts/**"],
  },
};

export default nextConfig;
