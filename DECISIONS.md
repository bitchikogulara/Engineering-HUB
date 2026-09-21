# DECISIONS.md — technical decision log

Format: lightweight ADRs, newest last. Status: `accepted` | `pending owner approval` | `superseded`.

---

## ADR-001 — Next.js 16 instead of 15

**Status:** accepted · 2026-09-21
**Context:** Spec (§10) names Next.js 15. Next.js 16 is the current stable line (16.3 as of Sept 2026): predictable caching semantics (fetch caching now opt-in), reliable Server Action error boundaries, React 19.2.
**Decision:** Build on Next.js 16, App Router, TypeScript strict.
**Consequence:** No migration debt at day one; spec references to 15 read as 16.

## ADR-002 — Supabase over Neon (resolves §13 open question)

**Status:** pending owner approval · 2026-09-21
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

## ADR-006 — Notification channel: in-app + Telegram bot (resolves §13 open question)

**Status:** pending owner approval · 2026-09-21
**Context:** Options were email, Telegram, in-app. Email from a hobby project needs a sending domain + deliverability work; the team lives on phones in a workshop where Telegram is ubiquitous, and a bot is free and instant.
**Decision:** Phase 4 ships in-app notifications + a Telegram bot (grammY, webhook mode). `notify()` dispatcher is channel-agnostic so email can be added later without touching call sites.

## ADR-007 — Form collaboration: field-level LWW + presence, not CRDT

**Status:** accepted · 2026-09-21
**Context:** FR-15 requires simultaneous editing (phase 5). Meeting forms are structured fields, not shared rich-text; the team is 2 people. Yjs/CRDT adds a heavy dependency for a conflict class that barely exists when users edit different fields.
**Decision:** Per-field last-write-wins synced over a Supabase Realtime broadcast channel per meeting, with presence indicators ("X is editing this field") to steer users away from same-field collisions. Autosave to Postgres remains the durability layer. Revisit with Yjs only if same-field conflicts occur in practice.

## ADR-008 — AI structured output via forced tool use

**Status:** accepted · 2026-09-21
**Context:** FR-19 demands strict JSON. Prompt-based "return JSON" is fragile; the Anthropic API enforces a JSON schema when the response is a forced tool call.
**Decision:** Extraction responses are a forced tool call whose input schema is generated from the shared Zod schema; output is Zod-validated again server-side, one retry on failure, then `pending_processing` (FR-25). Duplicate candidates are pre-computed with pg_trgm and injected into the prompt for the model to resolve explicitly.
