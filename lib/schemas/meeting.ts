import { z } from "zod";

// Template engine (FR-13): sections and questions are data, not code.
// A section can repeat per participant and can auto-load board context.

export const CONTEXT_QUERIES = [
  "my_open_tasks", // per-person: In-progress + Blocked cards
  "blocked_tasks",
  "stale_tasks",
  "overdue_tasks",
  "unfinished_tasks", // not done, created before this week
  "completed_this_week",
  "active_objectives",
] as const;
export type ContextQuery = (typeof CONTEXT_QUERIES)[number];

export const questionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(["short", "long", "checklist"]),
  placeholder: z.string().optional(),
});
export type TemplateQuestion = z.infer<typeof questionSchema>;

export const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  perPerson: z.boolean().default(false),
  context: z.enum(CONTEXT_QUERIES).optional(), // auto-loaded board state (FR-14)
  questions: z.array(questionSchema),
});
export type TemplateSection = z.infer<typeof sectionSchema>;

export const sectionsSchema = z.array(sectionSchema);

// Answers: { [sectionId]: { [userId or "_"]: { [questionId]: string } } }
// Per-person sections key by user id; shared sections use "_".
export const answersSchema = z.record(
  z.string(),
  z.record(z.string(), z.record(z.string(), z.string().max(20_000))),
);
export type MeetingAnswers = z.infer<typeof answersSchema>;

// Live co-editing (ADR-007): autosave sends only the fields that changed,
// and the server merges them — a full-object write would let two people
// editing at once overwrite each other's answers.
export const fieldPatchSchema = z.object({
  sectionId: z.string().min(1).max(100),
  personKey: z.string().min(1).max(100),
  questionId: z.string().min(1).max(100),
  value: z.string().max(20_000),
});
export type FieldPatch = z.infer<typeof fieldPatchSchema>;

export const saveMeetingSchema = z.object({
  id: z.string().uuid(),
  patches: z.array(fieldPatchSchema).max(500),
  // undefined = untouched this save; "" clears it
  freeText: z.string().max(50_000).optional(),
});

export const submitMeetingSchema = z.object({ id: z.string().uuid() });

export const startMeetingSchema = z.object({
  templateBaseId: z.string().uuid(),
});

export const objectiveSchema = z.object({
  title: z.string().trim().min(1).max(300),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ownerId: z.string().min(1),
  state: z.enum(["planned", "active", "achieved", "missed", "rolled"]),
  quarterlyPriorityId: z.string().uuid().nullable().optional(),
});
