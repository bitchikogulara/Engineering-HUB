import { z } from "zod";

// The extraction contract (FR-19): one Zod schema validates the model output,
// and the JSON Schema below (kept in lockstep) is enforced server-side via a
// strict tool definition. All fields are required; "absent" is null/[] so the
// strict schema stays simple and the model can't omit its way around fields.

const confidence = z.enum(["high", "medium", "low"]);

export const extractedTaskNew = z.object({
  title: z.string().min(1).max(300),
  description: z.string().nullable(),
  assignee: z.string().min(1), // participant first name or full name
  project: z.string().nullable(),
  objective: z.string().nullable(),
  type: z.string().nullable(), // task type name; null = Internal
  column: z.string().nullable(), // board column name; null = default placement
  blocked_reason: z.string().nullable(), // required in prompt when column is blocked
  priority: z.enum(["p1", "p2", "p3"]),
  estimate: z.enum(["s", "m", "l", "xl"]).nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  requester_name: z.string().nullable(),
  requester_department: z.string().nullable(),
  labels: z.array(z.string()),
  source_quote: z.string().min(1), // FR-20: the sentence that produced this
  confidence,
  needs_attention: z.boolean(),
});

export const extractedTaskUpdate = z.object({
  task_number: z.number().int().positive(), // EH-N
  column: z.string().nullable(), // target column name, null = unchanged
  assignee: z.string().nullable(),
  priority: z.enum(["p1", "p2", "p3"]).nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  blocked_reason: z.string().nullable(),
  note: z.string().nullable(), // human-readable summary of the change
  source_quote: z.string().min(1),
  confidence,
  needs_attention: z.boolean(),
});

export const extractedObjective = z.object({
  action: z.enum(["create", "update"]),
  title: z.string().min(1),
  state: z
    .enum(["planned", "active", "achieved", "missed", "rolled"])
    .nullable(),
  owner: z.string().nullable(),
  week_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  source_quote: z.string().min(1),
  confidence,
  needs_attention: z.boolean(),
});

export const extractedDecision = z.object({
  text: z.string().min(1),
  context: z.string().nullable(),
  source_quote: z.string().min(1),
  confidence,
  needs_attention: z.boolean(),
});

export const clarificationQuestion = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
});

export const extractionSchema = z.object({
  summary: z.string().min(1), // 2-4 sentence meeting summary (viewer-safe)
  tasks_new: z.array(extractedTaskNew),
  tasks_update: z.array(extractedTaskUpdate),
  objectives: z.array(extractedObjective),
  decisions: z.array(extractedDecision),
  clarification_questions: z.array(clarificationQuestion).max(5), // FR-21
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedTaskNew = z.infer<typeof extractedTaskNew>;
export type ExtractedTaskUpdate = z.infer<typeof extractedTaskUpdate>;

export const tunerSchema = z.object({
  proposed_instructions: z.string().min(1),
  rationale: z.string().min(1),
});
export type TunerOutput = z.infer<typeof tunerSchema>;

// ---------------------------------------------------------------------------
// JSON Schema for the strict tool (mirror of the Zod schema above).
// ---------------------------------------------------------------------------

const str = { type: "string" as const };
// Strict tools cap union counts, so the wire format has NO unions: absent =
// empty string, normalized to null by normalizeExtraction() before Zod.
const nullableStr = { type: "string" as const };
const bool = { type: "boolean" as const };
const conf = { type: "string" as const, enum: ["high", "medium", "low"] };
const dateOrNull = {
  type: "string" as const,
  pattern: "^(d{4}-d{2}-d{2})?$",
};

function obj(properties: Record<string, unknown>) {
  return {
    type: "object" as const,
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export const extractionJsonSchema = obj({
  summary: str,
  tasks_new: {
    type: "array",
    items: obj({
      title: str,
      description: nullableStr,
      assignee: str,
      project: nullableStr,
      objective: nullableStr,
      type: nullableStr,
      column: nullableStr,
      blocked_reason: nullableStr,
      priority: { type: "string", enum: ["p1", "p2", "p3"] },
      estimate: { type: "string", enum: ["s", "m", "l", "xl", ""] },
      due_date: dateOrNull,
      requester_name: nullableStr,
      requester_department: nullableStr,
      labels: { type: "array", items: str },
      source_quote: str,
      confidence: conf,
      needs_attention: bool,
    }),
  },
  tasks_update: {
    type: "array",
    items: obj({
      task_number: { type: "integer" },
      column: nullableStr,
      assignee: nullableStr,
      priority: { type: "string", enum: ["p1", "p2", "p3", ""] },
      due_date: dateOrNull,
      blocked_reason: nullableStr,
      note: nullableStr,
      source_quote: str,
      confidence: conf,
      needs_attention: bool,
    }),
  },
  objectives: {
    type: "array",
    items: obj({
      action: { type: "string", enum: ["create", "update"] },
      title: str,
      state: {
        type: "string",
        enum: ["planned", "active", "achieved", "missed", "rolled", ""],
      },
      owner: nullableStr,
      week_start: dateOrNull,
      source_quote: str,
      confidence: conf,
      needs_attention: bool,
    }),
  },
  decisions: {
    type: "array",
    items: obj({
      text: str,
      context: nullableStr,
      source_quote: str,
      confidence: conf,
      needs_attention: bool,
    }),
  },
  clarification_questions: {
    // ≤5 enforced by the Zod validator + prompt; strict tools reject maxItems
    type: "array",
    items: obj({ id: str, question: str }),
  },
});

/** Wire format uses "" for absent values (strict schema, no unions) —
 *  convert to null (and drop empty labels) before Zod validation. */
export function normalizeExtraction(raw: unknown): unknown {
  const walk = (v: unknown): unknown => {
    if (v === "") return null;
    if (Array.isArray(v)) return v.map(walk).filter((x) => x !== null);
    if (typeof v === "object" && v !== null) {
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, walk(x)]),
      );
    }
    return v;
  };
  return walk(raw);
}

export const tunerJsonSchema = obj({
  proposed_instructions: str,
  rationale: str,
});
