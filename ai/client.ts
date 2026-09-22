import "server-only";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { aiCall } from "@/db/schema";
import { serverEnv } from "@/lib/env";

// The ONLY module that talks to the Anthropic API (spec §10). Everything else
// goes through callStructured(), which forces a strict tool call, logs tokens
// and cost (FR-26), and hands back the raw tool input for Zod validation.

export const AI_MODEL = "claude-sonnet-5";

// $/MTok — used for the ai_calls cost column (FR-26, FR-38).
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
};

let client: Anthropic | undefined;
function getClient(): Anthropic {
  const key = serverEnv().ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured — add it to the environment to enable AI processing.",
    );
  }
  if (!client) {
    const workspaceId = serverEnv().ANTHROPIC_WORKSPACE_ID;
    client = new Anthropic({
      apiKey: key,
      ...(workspaceId
        ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } }
        : {}),
    });
  }
  return client;
}

const promptCache = new Map<string, { text: string; version: string }>();

/** Loads a versioned prompt from /ai/prompts (never inline in code). */
export function loadPrompt(name: string): { text: string; version: string } {
  const cached = promptCache.get(name);
  if (cached) return cached;
  const file = path.join(process.cwd(), "ai", "prompts", `${name}.md`);
  const text = fs.readFileSync(file, "utf8");
  const version = text.match(/version:\s*([\w.]+)/)?.[1] ?? "unknown";
  const loaded = { text, version };
  promptCache.set(name, loaded);
  return loaded;
}

export async function callStructured(opts: {
  purpose: "extract" | "revise" | "clarify_rerun" | "tune" | "summary";
  meetingId: string | null;
  promptVersion: string;
  system: string;
  userContent: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<unknown> {
  const anthropic = getClient();
  const started = Date.now();
  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      system: [
        {
          type: "text",
          text: opts.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: opts.userContent }],
      tools: [
        {
          name: opts.toolName,
          description: opts.toolDescription,
          input_schema: opts.inputSchema as Anthropic.Tool.InputSchema,
          strict: true,
        } as Anthropic.ToolUnion,
      ],
      tool_choice: { type: "tool", name: opts.toolName },
    });

    const price = PRICE_PER_MTOK[AI_MODEL] ?? { input: 0, output: 0 };
    const inputTokens =
      response.usage.input_tokens +
      (response.usage.cache_creation_input_tokens ?? 0) +
      (response.usage.cache_read_input_tokens ?? 0);
    await db.insert(aiCall).values({
      meetingId: opts.meetingId,
      purpose: opts.purpose,
      model: AI_MODEL,
      promptVersion: opts.promptVersion,
      inputTokens,
      outputTokens: response.usage.output_tokens,
      costUsd:
        (response.usage.input_tokens / 1e6) * price.input +
        ((response.usage.cache_creation_input_tokens ?? 0) / 1e6) *
          price.input *
          1.25 +
        ((response.usage.cache_read_input_tokens ?? 0) / 1e6) *
          price.input *
          0.1 +
        (response.usage.output_tokens / 1e6) * price.output,
      latencyMs: Date.now() - started,
      ok: true,
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) throw new Error("Model returned no tool call");
    return toolUse.input;
  } catch (err) {
    await db
      .insert(aiCall)
      .values({
        meetingId: opts.meetingId,
        purpose: opts.purpose,
        model: AI_MODEL,
        promptVersion: opts.promptVersion,
        latencyMs: Date.now() - started,
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 2000) : String(err),
      })
      .catch(() => {}); // cost logging must never mask the real failure
    throw err;
  }
}
