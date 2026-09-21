# Engineering Hub

Task board + weekly objectives + AI meeting assistant for the Transporter Group engineering department. See `Engineering Hub — Product Specification.md` for the product spec, `ARCHITECTURE.md` for the system design, and `DECISIONS.md` for the decision log. `design/` holds the frozen design handoff (open `design/index.html`); `app/tokens.css` is the live copy of the design tokens.

## Stack

Next.js 16 (App Router, TS strict) · Supabase Postgres · Drizzle · Better Auth (invite-only) · Tailwind 4 · Vitest · Biome. Deployed on Vercel.

## Setup

1. **Prereqs:** Node ≥ 22, npm.
2. **Install:** `npm install`
3. **Database:** create a Supabase project, then copy the *Transaction pooler* connection string.
4. **Env:** `cp .env.example .env` and fill it in (`openssl rand -base64 32` for `BETTER_AUTH_SECRET`).
5. **Migrate:** `npm run db:migrate`
6. **Run:** `npm run dev` → http://localhost:3000

**First user bootstrap:** on a fresh database, `/sign-in` shows a one-time "create admin account" form — the first account becomes **admin**. After that, sign-up is strictly invitation-only: admins create invite links under **Admin → Users**; links expire after 7 days.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | Biome check / autofix |
| `npm test` | Vitest (permission matrix, and per-phase mandatory suites) |
| `npm run db:generate` | Generate SQL migration from `db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed data (arrives with phase 1–2) |

## Environment variables

See `.env.example`. In production these live in Vercel project settings, never in the repo. `ANTHROPIC_API_KEY` is unused until phase 3.

## Deploy

Vercel project connected to this GitHub repo; merges to `main` auto-deploy. Set all env vars in Vercel (with `BETTER_AUTH_URL` = the production URL) and run migrations against the production database via CI (see `.github/workflows/ci.yml`).

## Repo layout

```
app/          routes (App Router) — (auth) public, (app) authenticated shell
components/   shared UI
db/           Drizzle schema, migrations, seed
ai/           prompts + extraction pipeline (phase 3)
lib/          auth, permissions, env, server actions, queries
tests/        Vitest suites
design/       frozen design handoff (tokens, mockups, notes)
```
