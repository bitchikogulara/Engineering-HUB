import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Auth tables (Better Auth core schema + our additional fields on user)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Engineering Hub roles: 'admin' | 'member' | 'viewer' (enforced in app code,
  // kept as text so the set can evolve without a migration)
  role: text("role").notNull().default("member"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Invitations — the only way into the app (FR-31). No public sign-up exists:
// user creation is rejected unless a live invitation matches the email
// (see lib/auth.ts databaseHooks), except the very first user, who becomes
// admin (bootstrap rule, documented in README).
// ---------------------------------------------------------------------------

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("invitation_email_idx").on(t.email)],
);

// ---------------------------------------------------------------------------
// Board configuration (admin-editable; task status is an FK to a column row,
// not an enum, so columns stay renameable — lifecycle rules key off the
// isBlocked / isDone flags, never off column names. FR-1)
// ---------------------------------------------------------------------------

export const boardColumn = pgTable("board_column", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  wipHint: integer("wip_hint"), // soft per-person warning threshold, null = off
  isBlocked: boolean("is_blocked").notNull().default(false),
  isDone: boolean("is_done").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const project = pgTable("project", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: integer("color").notNull().default(1), // index into --project-1…10 tokens
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// User-nameable task groups; external types require requester fields (FR-43/44)
export const taskType = pgTable("task_type", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("internal"), // token key: --type-<color>
  icon: text("icon").notNull().default("wrench"), // lucide icon name
  isExternal: boolean("is_external").notNull().default(false),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

// ---------------------------------------------------------------------------
// Tasks (FR-2). displayNumber renders as "EH-42". lastActivityAt drives the
// stale badge (FR-6); doneAt drives auto-archive (FR-5) — both computed at
// read time, no background jobs.
// ---------------------------------------------------------------------------

export const task = pgTable(
  "task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayNumber: integer("display_number").generatedAlwaysAsIdentity(),
    title: text("title").notNull(),
    description: text("description"), // markdown, checklists included
    columnId: uuid("column_id")
      .notNull()
      .references(() => boardColumn.id),
    position: doublePrecision("position").notNull().default(0), // fractional ordering inside a column
    assigneeId: text("assignee_id")
      .notNull()
      .references(() => user.id),
    projectId: uuid("project_id").references(() => project.id),
    objectiveId: uuid("objective_id").references(() => objective.id, {
      onDelete: "set null",
    }),
    typeId: uuid("type_id")
      .notNull()
      .references(() => taskType.id),
    requesterName: text("requester_name"), // required by validation for external types
    requesterDepartment: text("requester_department"),
    priority: text("priority").notNull().default("p2"), // p1 | p2 | p3
    estimate: text("estimate"), // s | m | l | xl
    dueDate: date("due_date"),
    blockedReason: text("blocked_reason"), // required when in a blocked column (FR-4)
    labels: text("labels").array().notNull().default([]),
    createdByType: text("created_by_type").notNull().default("user"), // user | ai (FR-32)
    createdById: text("created_by_id").notNull(),
    originMeetingId: uuid("origin_meeting_id").references(() => meeting.id),
    sourceQuote: text("source_quote"), // the meeting sentence that produced this task (FR-20)
    doneAt: timestamp("done_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("task_column_position_idx").on(t.columnId, t.position),
    index("task_assignee_idx").on(t.assigneeId),
    index("task_project_idx").on(t.projectId),
    index("task_type_idx").on(t.typeId),
  ],
);

export const taskComment = pgTable(
  "task_comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    parentId: uuid("parent_id"), // one-level threading
    body: text("body").notNull(),
    mentions: text("mentions").array().notNull().default([]), // mentioned user ids
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("task_comment_task_idx").on(t.taskId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Objectives (FR-8): a named weekly outcome with an owner and linked tasks.
// Progress is computed from linked tasks at read time.
// ---------------------------------------------------------------------------

export const objective = pgTable(
  "objective",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    weekStart: date("week_start").notNull(), // Monday of the objective's week
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    state: text("state").notNull().default("planned"), // planned|active|achieved|missed|rolled
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("objective_week_idx").on(t.weekStart, t.state)],
);

// ---------------------------------------------------------------------------
// Meeting templates (FR-12/13/39): templates are data. Each row is one
// immutable VERSION; rows sharing baseId are the same template over time.
// Sections/questions live in JSONB so admins can evolve them without code.
// ---------------------------------------------------------------------------

export const meetingTemplate = pgTable(
  "meeting_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    baseId: uuid("base_id").notNull(), // stable identity across versions
    version: integer("version").notNull().default(1),
    name: text("name").notNull(),
    cadence: text("cadence"), // human-readable now; RRULE in phase 4
    durationMinutes: integer("duration_minutes"),
    participants: text("participants"), // e.g. "Whole team", "Head + boss"
    reminderOffsets: integer("reminder_offsets")
      .array()
      .notNull()
      .default([15]),
    sections: jsonb("sections").notNull(), // TemplateSection[] (lib/schemas/meeting.ts)
    agendaRules: text("agenda_rules").array().notNull().default([]), // suggestion query keys
    extractionInstructions: text("extraction_instructions"), // appended to AI prompt (FR-42)
    active: boolean("active").notNull().default(true), // latest version flag
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("meeting_template_base_idx").on(t.baseId, t.version)],
);

export const meeting = pgTable(
  "meeting",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => meetingTemplate.id), // pins the exact version (FR-13)
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
    participants: text("participants").array().notNull().default([]), // user ids
    answers: jsonb("answers").notNull().default({}),
    freeText: text("free_text"), // "Additional notes" (FR-16)
    extraction: jsonb("extraction"), // latest AI proposal (ai/schemas.ts shape)
    appliedResult: jsonb("applied_result"), // what was applied vs rejected (FR-18)
    status: text("status").notNull().default("draft"), // draft|submitted|processed|confirmed|pending_processing
    summary: text("summary"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("meeting_status_idx").on(t.status, t.date)],
);

// ---------------------------------------------------------------------------
// AI pipeline (phase 3)
// ---------------------------------------------------------------------------

// Every Anthropic API call, with tokens and cost (FR-26).
export const aiCall = pgTable(
  "ai_call",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id").references(() => meeting.id, {
      onDelete: "set null",
    }),
    purpose: text("purpose").notNull(), // extract | revise | clarify_rerun | tune
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    ok: boolean("ok").notNull().default(true),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_call_meeting_idx").on(t.meetingId, t.createdAt)],
);

// Clarification exchange (FR-21): one row per round, questions + answers.
export const clarificationRound = pgTable(
  "clarification_round",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    round: integer("round").notNull().default(1),
    questions: jsonb("questions").notNull(), // [{id, question}]
    answers: jsonb("answers"), // {questionId: answer | null (skipped)}
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("clarification_meeting_idx").on(t.meetingId, t.round)],
);

// Proposal feedback (FR-46): free-text critique that drives a re-extraction.
export const feedbackRound = pgTable(
  "feedback_round",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    round: integer("round").notNull().default(1),
    feedback: text("feedback").notNull(),
    givenById: text("given_by_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("feedback_meeting_idx").on(t.meetingId, t.round)],
);

// AI-proposed instruction edits, applied only on admin approval (FR-47).
export const templateSuggestion = pgTable("template_suggestion", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => meetingTemplate.id),
  meetingId: uuid("meeting_id").references(() => meeting.id, {
    onDelete: "set null",
  }),
  proposedInstructions: text("proposed_instructions").notNull(),
  rationale: text("rationale").notNull(),
  status: text("status").notNull().default("pending"), // pending | applied | discarded
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Decision log entries (FR-30; written by the pipeline from phase 3,
// browsable UI arrives with phase 4).
export const decision = pgTable(
  "decision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    text: text("text").notNull(),
    context: text("context"),
    meetingId: uuid("meeting_id").references(() => meeting.id),
    date: date("date").notNull().defaultNow(),
    createdByType: text("created_by_type").notNull().default("user"), // user | ai
    createdById: text("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("decision_date_idx").on(t.date)],
);

// FR-41: a dismissed agenda suggestion is not re-suggested for 7 days.
export const suggestionDismissal = pgTable(
  "suggestion_dismissal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(), // stable hash of the suggestion content
    dismissedById: text("dismissed_by_id")
      .notNull()
      .references(() => user.id),
    dismissedUntil: timestamp("dismissed_until", {
      withTimezone: true,
    }).notNull(),
  },
  (t) => [index("suggestion_dismissal_key_idx").on(t.key)],
);

// Append-only audit trail; written in the same transaction as each mutation
// (FR-7, FR-32). Also the data source for the phase-4 analytics module.
export const activityLog = pgTable(
  "activity_log",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    entityType: text("entity_type").notNull(), // task | column | project | task_type | …
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(), // created | updated | moved | commented | deleted | …
    actorType: text("actor_type").notNull().default("user"), // user | ai
    actorId: text("actor_id").notNull(),
    diff: jsonb("diff"), // { field: { from, to } } — only what changed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("activity_entity_idx").on(t.entityType, t.entityId, t.createdAt),
  ],
);

export const schema = {
  user,
  session,
  account,
  verification,
  invitation,
  boardColumn,
  project,
  objective,
  meetingTemplate,
  meeting,
  suggestionDismissal,
  aiCall,
  clarificationRound,
  feedbackRound,
  templateSuggestion,
  decision,
  taskType,
  task,
  taskComment,
  activityLog,
};
