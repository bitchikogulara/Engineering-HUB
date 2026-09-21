# Design brief — prompt for the design agent

Copy everything below the line into the design session. The outcome (design system + screen mockups) comes back to the CTO agent for implementation with Tailwind + shadcn/ui.

---

You are the lead product designer for **Engineering Hub**, an internal web app for a 2-person engineering department (hardware/firmware/software, Transporter Group). It combines a Kanban task board, weekly objectives, and an AI meeting assistant: the team runs structured meetings in the app, and on submit an AI extracts tasks/decisions and proposes them for human confirmation. Their boss gets a read-only dashboard. It is used daily — often from a phone in a workshop — so it must be fast to scan, thumb-friendly, and completely free of enterprise-tool bloat.

## Product character

- **Tone:** a precise instrument, not a corporate suite. Think Linear's density and calm + a workshop logbook's matter-of-factness. No marketing gloss, no illustrations, no empty decoration.
- **Speed is the aesthetic:** the design should feel instant — dense but breathable layouts, minimal chrome, content-first. Anything that adds a click or a modal must justify itself.
- **Trust cues for AI:** everything the AI produced must be visibly distinguishable from human work (a subtle, consistent "AI" marker/badge with a link to its source meeting quote). The AI proposes; the human confirms — the UI language must never imply the AI acted on its own.
- **Two users + one viewer:** avatars/attribution everywhere matter more than in big-team tools; there are exactly 2–3 faces, make them recognizable at a glance.

## Design system deliverables

1. **Tokens:** color palette (light + dark mode, dark is first-class — workshop evenings), typography scale (a highly legible UI sans; monospace accents for IDs/timestamps welcome), spacing, radius, elevation. Must map cleanly onto Tailwind CSS variables / shadcn-ui theming (`--background`, `--primary`, etc.).
- Semantic colors needed: 6 board columns (Backlog, This week, In progress, Blocked, Review, Done — Blocked must be the loudest thing on screen), priorities P1/P2/P3, objective states (Planned/Active/Achieved/Missed/Rolled over), stale + overdue badges, AI-origin marker, per-project accent colors (admin-assignable, ~10 distinguishable hues).
2. **Core components:** task card (compact board variant + expanded detail sheet), column header with count + WIP hint, objective progress bar ("3/5 done") pinned above the board, meeting-form question blocks (short text, long text, per-person repeat, checklist, auto-loaded context card), agenda-suggestion chip (insert ✓ / dismiss ✕), clarification Q&A batch, proposal diff row (accept / edit / reject), confidence indicator, activity-log line, comment thread with @mention, empty states, toasts.
3. **App shell:** desktop = slim icon sidebar (Dashboard, Board, Meetings, Decisions, Archive, Admin) + topbar with global search (⌘K) and "next meeting" indicator. Mobile = bottom tab bar with the same five primary destinations; FAB or equivalent for "new task / start meeting".

## Screens to design (high-fidelity, desktop 1440 + mobile 390)

1. **Board** — 6-column Kanban, active weekly objectives pinned above as slim progress rows, filter bar, swimlane toggle. Show: a blocked card with reason, an overdue red badge, a stale badge, an AI-origin badge, drag state.
2. **Task detail** — side sheet (desktop) / full screen (mobile): all fields, checklist in description, activity log, comments, origin-meeting link with source quote.
3. **Meeting form (live)** — daily-sync example: per-person question groups, auto-loaded context cards ("your In-progress cards — confirm or adjust"), agenda-suggestion chips at top, free-text "Additional notes" at the end, autosave indicator, presence of the second participant, Submit.
4. **AI processing → clarification** — post-submit state: progress ("Extracting… ~20 s"), then a batch of up to 5 clarification questions, each answerable or skippable.
5. **Proposal screen (the signature screen)** — split view: meeting source text left with highlighted quotes; right, proposed items grouped (new tasks / updates / objectives / decisions), each with accept–edit–reject, confidence shown, skipped items flagged "needs attention"; sticky "Confirm all accepted" footer. Get this screen right before anything else.
6. **Dashboard (member)** — this week's objectives with progress, board snapshot (Blocked first), overdue/stale lists, next-7-days, next scheduled meeting, open decision requests.
7. **Dashboard (boss / viewer)** — simplified, read-only: quarter progress, weekly objectives, delivered-recently feed, decisions awaiting them. Calm, executive, zero clutter.
8. **Meetings hub** — upcoming (with overdue-meeting state) + past meetings list; a confirmed meeting record page (immutable, shows what the AI extracted and what was applied/rejected).
9. **Decision log** — chronological searchable list, each entry: decision, context, date, source-meeting link.

## Constraints

- Mobile-first for board + daily-sync form: one-handed use, drag-and-drop must have a touch-friendly alternative (move-via-menu).
- WCAG AA contrast in both themes; color never the only signal (badges carry icons/labels).
- English UI at launch; strings will be localized (Georgian) — avoid text-in-image, allow ~30% text expansion.
- Implementation target is Tailwind + shadcn/ui + dnd-kit — stay within what those can express; no bespoke physics or heavy animation. Micro-transitions ≤150 ms only.
- No native app; it's a PWA in a phone browser — respect safe areas, no hover-only affordances.

## Output format

1. A design-tokens spec (colors light+dark, type scale, spacing, radii) as a table or JSON mapped to shadcn/Tailwind CSS variable names.
2. High-fidelity mockups of the 9 screens (desktop + mobile for screens 1, 3, 5, 6, 7; desktop-only acceptable for the rest), delivered as HTML/CSS mockups or Figma frames — HTML preferred so the tokens are directly reusable.
3. A short rationale note per screen (3–5 sentences: key decisions, what to test).
4. The component sheet from "Core components" rendered in both themes.

Prioritize in this order if scope must be cut: tokens → board → proposal screen → meeting form → dashboards → the rest.
