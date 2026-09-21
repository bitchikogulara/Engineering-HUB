# Engineering Hub — design notes

Static HTML/CSS handoff for the Transporter Group engineering app. Everything is built to be lifted into **Tailwind + shadcn/ui + dnd-kit**. Open `index.html` to browse; toggle light/dark from any page (persisted in `localStorage`, boots **dark** because most use is workshop evenings).

## Token & system decisions

- **`tokens.css` is the contract.** `:root, [data-theme="light"]` holds light; `[data-theme="dark"]` holds dark. Names match shadcn/Tailwind 1:1 (`--background`, `--foreground`, `--primary`, `--muted`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, …) so the CTO agent can paste the variable block into `globals.css` and wire `tailwind.config` to `hsl(var(--…))`-style references. The `[data-theme]` attribute is exactly what shadcn's dark-mode-by-class/attr expects.
- **Semantic sets** are additive tokens the base shadcn theme doesn't ship: `--col-*` (6 board columns), `--priority-p1/p2/p3`, `--obj-*` (objective states), `--badge-stale/overdue`, `--ai-origin`, `--type-*` (task types), `--project-1…10`, `--confidence-*`. Each carries a `-bg` fill and `-fg` on-fill text tuned for **WCAG AA** in *both* themes — use the triple, don't re-derive.
- **Blocked is the loudest thing in the system** by design: the only column with a filled header, its own left-border on cards, and a red block-reason row. Priority P1 and overdue share the red family but never outshout a blocked column header.
- **Color is never the only signal.** Every badge pairs color with an icon and/or label; objective states are square badges, priorities carry a flag, external tasks an arrow-in. Safe for the Georgian localization pass and for colorblind users.
- **Type:** IBM Plex Sans for UI, IBM Plex Mono for IDs/timestamps/counts/money (`.num`, `.mono`) — an engineering-instrument feel, and the mono makes `EH-482`, `14:32`, `v1.4.0-rc2` scannable. Scale in `base.css` (`.t-display` → `.t-2xs`), all ≥12px so ~30% text expansion won't break layouts.
- **Shell:** slim 60px icon sidebar (Dashboard, Board, Meetings, Decisions, Archive, Admin) + a 52px topbar (⌘K search, "next meeting" indicator, theme toggle) on desktop; a bottom tab bar (5 primary destinations) + FAB on mobile. No hover-only affordances; safe-area insets respected for PWA. Breakpoint 760px.
- **AI provenance** is one consistent vocabulary: the `--ai-origin` violet is used *nowhere else*, always as the `.ai-tag` badge (icon + "AI" + link to source), and the language is always "proposed / created from meeting" — the AI never appears to have acted alone.

## Per-screen rationale

**components.html** — The single source of truth for the CTO agent. Renders each component in **both themes at once** (scoped `[data-theme]` containers) so contrast can be checked without toggling. Test: confirm the diff-row and confidence chips read clearly on the `--card` surface in dark before implementing.

**01 Board** — 6 columns scroll horizontally (columns become ~86vw on mobile so one is thumb-readable at a time); weekly objectives sit above as slim progress rows, always visible. Shows every required state: blocked card + reason, overdue + stale badges, an AI-origin card, an external service-request card (`Service · G. Beridze`), and a live drag state (ghost card + drop slot) that maps to dnd-kit. **User-test:** whether the drag ghost + "move via menu" alternative is discoverable on touch, and whether 6 columns feel too tight at 390px.

**02 Task detail** — A right side sheet over a dimmed board (full-screen on mobile) so context isn't lost. All fields, checklist-in-description, activity log, threaded comments with @mention, and the origin-meeting block with the actual source quote and a deep link. **User-test:** whether the origin quote earns its vertical space or should collapse by default.

**03 Meeting form (live)** — Per-person question groups **repeat per participant** (the core scalability move — two shown, the pattern is identical at ten). Auto-loaded context cards ("your in-progress cards — confirm or adjust"), agenda-suggestion chips up top, autosave + live presence of the second participant, free-text notes at the end. **User-test:** at ~10 people, whether the page gets too long and needs per-person collapse or a jump-nav.

**04 AI processing → clarification** — Two moments in one file: the extraction progress banner ("Extracting… ~14s") and the batch of ≤5 clarifications, each with quick-pick chips, a free-text fallback, and a skip. Skipping is first-class and explained ("anything you skip, the AI leaves out"). **User-test:** whether 5 questions feels like friction after a 2-minute standup — may need to cap at 3.

**05 Proposal (signature)** — The screen everything else defers to. Split view: meeting transcript left with **quote highlights** that link to each proposed item; right, proposals **grouped** (new tasks / updates / objectives / decisions) each with accept–edit–reject and a confidence chip. A low-confidence item is flagged **"needs attention"** and blocks "Confirm all" until resolved; a rejected item shows struck-through with undo. Sticky footer tallies accepted/rejected. **User-test this first:** does the source↔proposal link help trust, and is "needs attention" gating the right amount of friction.

**06 Dashboard (member)** — Working dashboard: this week's objectives, a 6-cell board snapshot with **Blocked first and loud**, overdue/stale list, next 7 days, next meeting (one-tap start), and open decision requests. Everything is one action from here.

**07 Dashboard (boss / viewer)** — Deliberately calmer and read-only (a persistent "Viewer" chip, no FAB, no edit actions): quarter donut, weekly objectives, a delivered-recently feed, and decisions awaiting the boss. Fewer numbers, more "are we on track." **User-test:** whether the boss wants the throughput trend here or is happy sending them to Analytics.

**08 Meetings hub** — Upcoming (including an **overdue-meeting** state for a skipped weekly planning) and past lists, plus the **immutable confirmed-meeting record** showing what the AI extracted and what was applied vs rejected, with an acceptance stat. The lock chip signals immutability. **User-test:** whether "immutable" needs an explainer tooltip.

**09 Decision log** — A searchable chronological timeline; each entry shows decision, context, date, author avatar, and a source-meeting link. Timeline nodes distinguish AI-logged (violet) from human-logged (primary) decisions. **User-test:** whether search + project chips are enough filtering at ~200 decisions/year.

**10 Analytics** — Range selector + a 2-col grid of charts, each with a **one-line headline stat** because the owner reads this walking into a meeting: throughput/week (bar), completed split by project/type/assignee (switchable stacked), external requests by department, days spent blocked, objectives hit rate (donut), AI acceptance + monthly model cost. Charts are drawn in plain CSS/SVG here but every one maps to a standard **Recharts** form (bar / stacked bar / donut). **User-test:** which single headline each chart should lead with.

## Known gaps / for implementation
- Charts are static CSS mockups — swap for Recharts; the token colors (`--project-*`, `--obj-*`, `--type-service`) are the intended series colors.
- Drag-and-drop is shown as a static state; implement with dnd-kit and keep the "move via menu" alternative for touch.
- Empty states are shown on the Board (Done column) and as component-sheet examples; replicate the `.empty` pattern per surface.
- Money is shown in both ₾ (boss budget approvals) and $ (model cost) intentionally — confirm currency conventions before launch.
