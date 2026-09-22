import { z } from "zod";

// Validated lazily (first access at runtime, not at build time) so `next build`
// works without secrets and CI never needs real credentials.
const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be ≥32 chars"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(), // required from phase 3
  ANTHROPIC_WORKSPACE_ID: z.string().optional(), // for non-workspace-scoped keys
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  if (!cached) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`Invalid environment: ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}
