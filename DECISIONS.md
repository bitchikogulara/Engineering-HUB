# DECISIONS.md — technical decision log

Format: lightweight ADRs, newest last. Status: `accepted` | `pending owner approval` | `superseded`.

---

## ADR-001 — Next.js 16 instead of 15

**Status:** accepted · 2026-09-21
**Context:** Spec (§10) names Next.js 15. Next.js 16 is the current stable line (16.3 as of Sept 2026): predictable caching semantics (fetch caching now opt-in), reliable Server Action error boundaries, React 19.2.
**Decision:** Build on Next.js 16, App Router, TypeScript strict.
**Consequence:** No migration debt at day one; spec references to 15 read as 16.

## ADR-002 — Supabase over Neon (resolves §13 open question)

**Status:** accepted (owner approved 2026-09-21)
**Context:** Spec left Neon+Auth.js vs Supabase open. We need Postgres **and** a realtime channel (live board moves phase 1, collaborative forms phase 5) **and** a scheduler for reminders. Neon would require adding Pusher/Ably (realtime) and an external cron service — three vendors instead of one. Supabase bundles Postgres, Realtime, pg_cron, Storage, daily backups on the free tier. Known caveat: free projects pause after ~7 days of inactivity — irrelevant for a daily-use tool, and a pg_cron heartbeat exists anyway.
**Decision:** Supabase Postgres as the database platform. We do NOT use Supabase Auth or client-side RLS data access — auth is Better Auth (ADR-004), all data access via Drizzle server-side; Supabase's client SDK is used for Realtime subscriptions only.
**Consequence:** One vendor for DB/realtime/cron/backups; portability preserved (plain Postgres + Drizzle migrations — moving to Neon later is a connection-string change plus a realtime substitute).

## ADR-003 — Drizzle over Prisma

**Status:** accepted · 2026-09-21
**Context:** Both are mature in 2026. Drizzle: TypeScript-native schema, no codegen step, SQL-close (we need pg_trgm similarity, tsvector search, JSONB queries), smaller bundle → faster serverless cold starts.
**Decision:** Drizzle + drizzle-kit migrations committed to the repo.

## ADR-004 — Better Auth instead of Auth.js (deviation from §10)

**Status:** accepted · 2026-09-21
**Context:** Spec names Auth.js. Since September 2025, Auth.js is in security-patch-only maintenance and is maintained by the Better Auth team, who recommend Better Auth for new projects. Better Auth: DB-backed sessions in our own Postgres, immediate revocation, first-class email/password + GitHub OAuth, clean invite-flow support.
**Decision:** Better Auth with GitHub OAuth + credentials, invitation-only (invitations table gates sign-up). Library-level substitution permitted by spec §0 with justification — this is it.

## ADR-005 — Scheduling via pg_cron, not Vercel Cron

**Status:** accepted · 2026-09-21
**Context:** Reminders need ≤5-minute granularity ("15 min before meeting", FR-40). Vercel Hobby cron is limited to coarse schedules; upgrading Vercel plan just for cron violates the cost ceiling (FR-38).
**Decision:** Supabase pg_cron fires every 5 min → `net.http_post` to `/api/cron/tick` secured with `CRON_SECRET`. All schedule logic lives in the app; pg_cron is only the clock.

## ADR-006 — Notification channel: in-app + WhatsApp (resolves §13 open question)

**Status:** accepted (owner chose WhatsApp, 2026-09-21)
**Context:** Owner picked WhatsApp + in-app over Telegram/email. WhatsApp requires the Meta WhatsApp Business Cloud API: a Meta Business account, a verified sender phone number, and pre-approved message templates for business-initiated notifications, which are billed per message (fractions of a cent; negligible at our volume but not zero, unlike Telegram). Setup friction is front-loaded and one-time.
**Decision:** Phase 4 ships in-app notifications + WhatsApp via the Business Cloud API (approved utility templates for reminders/digests/mentions, each with a deep link). `notify()` dispatcher stays channel-agnostic so Telegram/email can be added without touching call sites. If Meta business verification stalls, in-app ships first and WhatsApp follows — reminders must not block phase 4.

## ADR-007 — Form collaboration: field-level LWW + presence, not CRDT

**Status:** accepted · 2026-09-21
**Context:** FR-15 requires simultaneous editing (phase 5). Meeting forms are structured fields, not shared rich-text; the team is 2 people. Yjs/CRDT adds a heavy dependency for a conflict class that barely exists when users edit different fields.
**Decision:** Per-field last-write-wins synced over a Supabase Realtime broadcast channel per meeting, with presence indicators ("X is editing this field") to steer users away from same-field collisions. Autosave to Postgres remains the durability layer. Revisit with Yjs only if same-field conflicts occur in practice.

## ADR-008 — AI structured output via forced tool use

**Status:** accepted · 2026-09-21
**Context:** FR-19 demands strict JSON. Prompt-based "return JSON" is fragile; the Anthropic API enforces a JSON schema when the response is a forced tool call.
**Decision:** Extraction responses are a forced tool call whose input schema is generated from the shared Zod schema; output is Zod-validated again server-side, one retry on failure, then `pending_processing` (FR-25). Duplicate candidates are pre-computed with pg_trgm and injected into the prompt for the model to resolve explicitly.

## ADR-009 — Owner rulings, 2026-09-21

**Status:** accepted
**Boss access:** Viewer login arrives with the phase-4 boss dashboard; until then the boss gets token-based summary links only.
**Daily sync:** stays a live meeting form as the default. The meeting-type model already carries a mode field conceptually — an async check-in variant (each person fills their block before a deadline, AI processes when all have submitted) will be added later as a per-occurrence choice, not a replacement. Build meeting records so a meeting can have per-participant submission timestamps to keep that door open.
**Scale:** design for N users, not 2 — per-person form sections, swimlanes, dashboards, and the permission model must not hard-code team size. The spec's "works for 2, nothing breaks at 10" is a floor, not a ceiling.

## ADR-010 — Task types as a first-class, user-manageable dimension

**Status:** accepted (owner request, 2026-09-21)
**Context:** Work arrives from outside the department (service dept print jobs, repairs) and must be documented and countable, not lost among internal tasks. Labels are too loose (multi-select, no requester data); projects mean something else.
**Decision:** `task_types` table, admin/user-manageable (name, color, icon, `is_external` flag), seeded with Internal / Service request / Print job / Repair / Admin. `task_type_id` required on every task (default Internal). External types require requester name + department. Intake is team-logged in v1 — owner explicitly chose no outside access; the model (requester distinct from assignee, type as FK) leaves a later token-based intake form a pure addition, not a migration.
**Consequence:** New FR-43/FR-44 in the spec, phase 1. Task type becomes a filter, an optional swimlane grouping, and a core analytics dimension.

## ADR-012 — Database driver: node-postgres (pg), not postgres.js

**Status:** accepted · 2026-09-21 (during phase 1)
**Context:** ADR-003 paired Drizzle with postgres.js. In practice, postgres.js deadlocked inside the Next.js dev server under concurrent queries against the Supabase transaction pooler: Postgres showed the backends in `ClientRead` (results sent), while the Node client never drained the socket — requests hung for minutes. The identical SQL ran in <1 s from a standalone script.
**Decision:** Swap the runtime driver to node-postgres (`pg`) with a small pool (max 5, 20 s idle timeout, 10 s connect timeout, TLS). Drizzle API unchanged; drizzle-kit migrations unaffected; seed script still uses postgres.js in a single-shot process where the bug does not manifest.
**Consequence:** Boring, battle-tested driver in the request path; board renders went from minutes/hung to <1 s.

## ADR-013 — Two-loop AI feedback: revise the proposal, then tune the instructions

**Status:** accepted (owner design, 2026-09-22)
**Context:** Extraction quality depends on team-specific phrasing the base prompts can't know. The owner wants the AI tunable through use, not through code changes.
**Decision:** Two loops in the phase-3 pipeline. **Loop 1 (per meeting):** the proposal screen takes free-text feedback; the AI re-extracts with the feedback applied; rounds repeat until confirmation; exchanges are stored on the meeting. **Loop 2 (per template):** after confirming a meeting that needed feedback, a tuning call diffs the first proposal against the accepted result + feedback and proposes an edit to the template's extraction-instructions block, shown as a diff; admin approval writes a new template version. The AI never edits its own instructions unapproved — the FR-23 confirm-before-write principle extended to prompts themselves (FR-46/47).
**Consequence:** The system converges on the team's language during the first weeks of use; instruction history is fully versioned and auditable; marginal cost is cents (each revision round is one extra Sonnet call).

## ADR-014 — UI strings stay inline for v1; Georgian i18n deferred

**Status:** accepted (conscious deviation from FR-37, 2026-09-22)
**Context:** FR-37 wants all UI strings in one messages file so Georgian can be added. Extracting every string across ~40 components now would be a large, error-prone refactor with zero user-visible benefit until a Georgian translation actually exists — and the team works in English-first UI today. The half of FR-37 that matters operationally (AI handles mixed Georgian/English meeting notes, with test fixtures) is implemented and verified.
**Decision:** Strings remain inline for v1. When Georgian is requested, do the extraction in one dedicated pass (mechanical, AI-assisted) into `/messages/{en,ka}.json` with next-intl.
**Consequence:** FR-37's file-structure clause is deferred tech debt, logged here rather than silently skipped.

## ADR-011 — Analytics: in-app SQL over activity log, no vendor

**Status:** accepted (owner request, 2026-09-21)
**Context:** Owner wants an analytics dashboard ("where does our time go", external-request load, throughput). Data volume is tiny; a product-analytics SaaS would add cost, an external data flow for internal business info, and nothing we can't compute ourselves.
**Decision:** All analytics are SQL aggregates over tasks + the append-only `activity_log` (which already timestamps every column move, giving time-in-column and days-blocked for free), exposed via `/lib/queries/analytics.ts` and rendered with Recharts. Range selection in URL params. Phase 4 ships the core cuts (FR-45); phase 5 adds trends. Headline charts are reused by the boss dashboard and weekly PDF.
**Consequence:** Zero added vendors or cost; analytics correctness depends on activity-log completeness, which FR-32 already mandates and tests cover.
