# Design brief — prompt for the design agent (Claude Code)

Copy everything below the line into a Claude Code session started in an empty folder. The outcome (design system + screen mockups as static HTML) comes back to the CTO agent for implementation with Tailwind + shadcn/ui.

---

You are the lead product designer for **Engineering Hub**, an internal web app for a 2-person engineering department (hardware/firmware/software, Transporter Group). It combines a Kanban task board, weekly objectives, and an AI meeting assistant: the team runs structured meetings in the app, and on submit an AI extracts tasks/decisions and proposes them for human confirmation. Their boss gets a read-only dashboard. It is used daily — often from a phone in a workshop — so it must be fast to scan, thumb-friendly, and completely free of enterprise-tool bloat.

## Product character

- **Tone:** a precise instrument, not a corporate suite. Think Linear's density and calm + a workshop logbook's matter-of-factness. No marketing gloss, no illustrations, no empty decoration.
- **Speed is the aesthetic:** the design should feel instant — dense but breathable layouts, minimal chrome, content-first. Anything that adds a click or a modal must justify itself.
- **Trust cues for AI:** everything the AI produced must be visibly distinguishable from human work (a subtle, consistent "AI" marker/badge with a link to its source meeting quote). The AI proposes; the human confirms — the UI language must never imply the AI acted on its own.
- **Small team, built to grow:** today it's 2 engineers + 1 viewer, but every layout must scale gracefully to ~10 people — per-person form sections repeat per participant, swimlanes and dashboards can't assume two rows. Attribution matters everywhere: avatars must be recognizable at a glance at any team size.

## Design system deliverables

1. **Tokens:** color palette (light + dark mode, dark is first-class — workshop evenings), typography scale (a highly legible UI sans; monospace accents for IDs/timestamps welcome), spacing, radius, elevation. Must map cleanly onto Tailwind CSS variables / shadcn-ui theming (`--background`, `--primary`, etc.).
- Semantic colors needed: 6 board columns (Backlog, This week, In progress, Blocked, Review, Done — Blocked must be the loudest thing on screen), priorities P1/P2/P3, objective states (Planned/Active/Achieved/Missed/Rolled over), stale + overdue badges, AI-origin marker, per-project accent colors (admin-assignable, ~10 distinguishable hues), task-type chips (user-named groups like Internal / Service request / Print job — color + icon, admin-assignable; external types get a subtle "from outside" cue such as an arrow-in icon).
2. **Core components:** task card (compact board variant + expanded detail sheet; both show the task-type chip, and external tasks show requester + department, e.g. "Service · G. Beridze"), column header with count + WIP hint, objective progress bar ("3/5 done") pinned above the board, meeting-form question blocks (short text, long text, per-person repeat, checklist, auto-loaded context card), agenda-suggestion chip (insert ✓ / dismiss ✕), clarification Q&A batch, proposal diff row (accept / edit / reject), confidence indicator, activity-log line, comment thread with @mention, empty states, toasts.
3. **App shell:** desktop = slim icon sidebar (Dashboard, Board, Meetings, Decisions, Archive, Admin) + topbar with global search (⌘K) and "next meeting" indicator. Mobile = bottom tab bar with the same five primary destinations; FAB or equivalent for "new task / start meeting".

## Screens to design (high-fidelity, desktop 1440 + mobile 390)

1. **Board** — 6-column Kanban, active weekly objectives pinned above as slim progress rows, filter bar, swimlane toggle (by project, assignee, or task type). Show: a blocked card with reason, an overdue red badge, a stale badge, an AI-origin badge, an external service-request card with requester shown, drag state.
2. **Task detail** — side sheet (desktop) / full screen (mobile): all fields, checklist in description, activity log, comments, origin-meeting link with source quote.
3. **Meeting form (live)** — daily-sync example: per-person question groups, auto-loaded context cards ("your In-progress cards — confirm or adjust"), agenda-suggestion chips at top, free-text "Additional notes" at the end, autosave indicator, presence of the second participant, Submit.
4. **AI processing → clarification** — post-submit state: progress ("Extracting… ~20 s"), then a batch of up to 5 clarification questions, each answerable or skippable.
5. **Proposal screen (the signature screen)** — split view: meeting source text left with highlighted quotes; right, proposed items grouped (new tasks / updates / objectives / decisions), each with accept–edit–reject, confidence shown, skipped items flagged "needs attention"; sticky "Confirm all accepted" footer. Get this screen right before anything else.
6. **Dashboard (member)** — this week's objectives with progress, board snapshot (Blocked first), overdue/stale lists, next-7-days, next scheduled meeting, open decision requests.
7. **Dashboard (boss / viewer)** — simplified, read-only: quarter progress, weekly objectives, delivered-recently feed, decisions awaiting them. Calm, executive, zero clutter.
8. **Meetings hub** — upcoming (with overdue-meeting state) + past meetings list; a confirmed meeting record page (immutable, shows what the AI extracted and what was applied/rejected).
9. **Decision log** — chronological searchable list, each entry: decision, context, date, source-meeting link.
10. **Analytics** — range selector (week / month / quarter) + a grid of charts: throughput per week (bar), completed tasks split by project / task type / assignee (switchable), external-request volume by requesting department, days-spent-blocked, objectives hit rate, AI acceptance rate + cost. Design for scannability — the owner walks into a meeting with this screen; every chart needs a one-line headline stat. Charts render with Recharts, so stay within standard bar/line/donut/stacked forms.

## Constraints

- Mobile-first for board + daily-sync form: one-handed use, drag-and-drop must have a touch-friendly alternative (move-via-menu).
- WCAG AA contrast in both themes; color never the only signal (badges carry icons/labels).
- English UI at launch; strings will be localized (Georgian) — avoid text-in-image, allow ~30% text expansion.
- Implementation target is Tailwind + shadcn/ui + dnd-kit — stay within what those can express; no bespoke physics or heavy animation. Micro-transitions ≤150 ms only.
- No native app; it's a PWA in a phone browser — respect safe areas, no hover-only affordances.

## Deliverables — exact file structure

Create this in the working directory (nothing else, no build step):

```
/design
  tokens.css        ALL design tokens as CSS custom properties on :root
                    (light) and [data-theme="dark"], named to map 1:1 onto
                    shadcn/Tailwind variables (--background, --foreground,
                    --primary, --muted, --destructive, --radius, …) plus the
                    semantic set from this brief (--col-blocked, --priority-p1,
                    --badge-stale, --ai-origin, --type-service, …)
  base.css          typography scale, spacing utilities shared by all pages
  index.html        gallery page linking every mockup, with a light/dark toggle
  components.html   the full component sheet, every component in both themes
  01-board.html … 10-analytics.html   one file per screen, numbered as listed
  NOTES.md          per-screen rationale (3–5 sentences each: key decisions,
                    what to user-test) + any token decisions worth explaining
```

Rules for the mockups:

- **Static, self-contained HTML + CSS only.** Every page links only `tokens.css` and `base.css`. No frameworks, no React, no Tailwind CDN, no build tools, no external JS. The only JavaScript allowed: the theme toggle (sets `data-theme` on `<html>`, persisted in localStorage) and trivial show/hide for demonstrating states.
- Fonts via Google Fonts `<link>` only; pick max 2 families. Icons: inline SVG (Lucide-style), no icon-font CDNs.
- **Colors only via the tokens** — if a color appears in a page's CSS as a raw hex value instead of `var(--…)`, that's a bug. The implementation will consume `tokens.css` directly.
- Every screen must render correctly in both themes and at both 1440 px and 390 px wide (responsive in the same file — no separate mobile files). Check dark mode on every screen, not just the first.
- Fill every screen with **realistic engineering-department data** (CAN bus readers, ESP32 boards, FaceGate Android app, diagnostics app, service-dept print requests, names like Bitchiko and Nikoloz) — never "Lorem ipsum" or "Task 1". Show populated states AND one empty state per major surface.
- After building each page, review it at both widths in both themes before moving on; fix contrast failures (WCAG AA) immediately.

Work in this order and stop for feedback after step 2: (1) `tokens.css` + `base.css` + `components.html`, (2) board + proposal screen, (3) meeting form + dashboards + analytics, (4) the rest + `index.html` + `NOTES.md`. If scope must be cut, cut from the tail of that order — never from the tokens or the proposal screen.
