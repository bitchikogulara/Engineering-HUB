// The six default meeting templates (spec §6.1) as seed data (FR-12, FR-39).
// Every template ends with the free-text "Additional notes" box, which is a
// fixed part of the meeting form itself (FR-16), not a template section.

import type { TemplateSection } from "@/lib/schemas/meeting";

type TemplateSeed = {
  name: string;
  cadence: string;
  durationMinutes: number;
  participants: string;
  sections: TemplateSection[];
  agendaRules: string[];
  extractionInstructions: string;
};

export const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    name: "Daily sync",
    cadence: "Every workday 09:30",
    durationMinutes: 10,
    participants: "Whole team",
    agendaRules: ["blocked_tasks", "overdue_tasks"],
    extractionInstructions:
      "Prefer tasks_update over tasks_new; only create a new task if no open card matches. Move tasks to Blocked with the stated reason. Flag any task whose answers are unchanged three days running.",
    sections: [
      {
        id: "status",
        title: "Status round",
        perPerson: true,
        context: "my_open_tasks",
        questions: [
          {
            id: "yesterday",
            label: "What did I complete yesterday?",
            kind: "long",
          },
          { id: "today", label: "What am I doing today?", kind: "long" },
          {
            id: "blockers",
            label: "Anything blocking me?",
            kind: "long",
            placeholder: "Name the blocker and what would unblock it",
          },
        ],
      },
    ],
  },
  {
    name: "Weekly planning",
    cadence: "Monday 10:00",
    durationMinutes: 30,
    participants: "Whole team",
    agendaRules: ["blocked_tasks", "stale_tasks", "overdue_tasks"],
    extractionInstructions:
      "Create this week's objectives and their linked tasks with owners. Close or roll over last week's unfinished items as stated. Objectives are outcomes, not activities.",
    sections: [
      {
        id: "carryover",
        title: "Carry-over review",
        description: "Each unfinished task: keep / drop / re-scope.",
        perPerson: false,
        context: "unfinished_tasks",
        questions: [
          {
            id: "decisions",
            label: "Keep / drop / re-scope decisions",
            kind: "long",
          },
        ],
      },
      {
        id: "objectives",
        title: "This week's objectives",
        description: "2–4 objectives phrased as outcomes.",
        perPerson: false,
        questions: [
          { id: "list", label: "Objectives for this week", kind: "long" },
        ],
      },
      {
        id: "breakdown",
        title: "Task breakdown",
        perPerson: false,
        questions: [
          {
            id: "tasks",
            label: "Tasks per objective, each with an owner",
            kind: "long",
          },
        ],
      },
      {
        id: "capacity",
        title: "Capacity check",
        perPerson: false,
        questions: [
          {
            id: "capacity",
            label: "Travel, showroom support, holidays this week",
            kind: "long",
          },
          {
            id: "headsplit",
            label: "Head's hands-on vs. coordination split",
            kind: "short",
          },
        ],
      },
    ],
  },
  {
    name: "Weekly review",
    cadence: "Friday 16:30",
    durationMinutes: 20,
    participants: "Whole team",
    agendaRules: ["overdue_tasks"],
    extractionInstructions:
      "Record objective state changes (achieved / missed / rolled over) with reasons. Create follow-up tasks for shipped items. Tag boss-agenda items for the next boss sync.",
    sections: [
      {
        id: "objectives",
        title: "Objective outcomes",
        description: "Per objective: hit or missed, and why.",
        perPerson: false,
        context: "active_objectives",
        questions: [
          { id: "outcomes", label: "Hit / missed and why", kind: "long" },
        ],
      },
      {
        id: "followups",
        title: "Shipped items needing follow-up",
        description: "Docs, informing sales, field testing…",
        perPerson: false,
        context: "completed_this_week",
        questions: [{ id: "items", label: "Follow-ups", kind: "long" }],
      },
      {
        id: "wins",
        title: "Wins worth noting",
        perPerson: false,
        questions: [{ id: "wins", label: "Wins", kind: "long" }],
      },
      {
        id: "boss",
        title: "Items to raise with the boss",
        perPerson: false,
        questions: [{ id: "items", label: "Boss-agenda items", kind: "long" }],
      },
    ],
  },
  {
    name: "Monthly retrospective",
    cadence: "Last Friday 15:00",
    durationMinutes: 45,
    participants: "Whole team",
    agendaRules: ["stale_tasks"],
    extractionInstructions:
      "Extract process-change decisions (max 2 committed changes) into decisions, and improvement tasks with owners.",
    sections: [
      {
        id: "worked",
        title: "What worked well",
        perPerson: false,
        questions: [{ id: "worked", label: "What worked", kind: "long" }],
      },
      {
        id: "slowed",
        title: "What slowed us down",
        perPerson: false,
        questions: [{ id: "slowed", label: "What slowed us", kind: "long" }],
      },
      {
        id: "changes",
        title: "What we change next month",
        description: "Max 2 changes.",
        perPerson: false,
        questions: [
          { id: "changes", label: "Committed changes", kind: "long" },
        ],
      },
      {
        id: "lastretro",
        title: "Did we do last retro's changes?",
        perPerson: false,
        questions: [{ id: "check", label: "Outcome", kind: "long" }],
      },
      {
        id: "gaps",
        title: "Tooling / skills gaps",
        perPerson: false,
        questions: [{ id: "gaps", label: "Gaps", kind: "long" }],
      },
      {
        id: "meta",
        title: "Is the meeting structure itself still working?",
        perPerson: false,
        questions: [
          { id: "meta", label: "Verdict + adjustments", kind: "long" },
        ],
      },
    ],
  },
  {
    name: "Boss sync",
    cadence: "Weekly (day set by admin)",
    durationMinutes: 30,
    participants: "Head + boss",
    agendaRules: [],
    extractionInstructions:
      "Extract decision-log entries and decision-request items with due dates. Record priority changes. Generate the shareable boss summary in business language.",
    sections: [
      {
        id: "delivered",
        title: "Delivered since last sync",
        description: "In business terms.",
        perPerson: false,
        questions: [{ id: "delivered", label: "Delivered", kind: "long" }],
      },
      {
        id: "priorities",
        title: "Current priorities",
        perPerson: false,
        questions: [{ id: "priorities", label: "Priorities", kind: "long" }],
      },
      {
        id: "decisions",
        title: "Decisions needed",
        description: "Each with a deadline.",
        perPerson: false,
        questions: [{ id: "needed", label: "Decision requests", kind: "long" }],
      },
      {
        id: "risks",
        title: "Risks and blockers",
        perPerson: false,
        context: "blocked_tasks",
        questions: [{ id: "risks", label: "Risks / blockers", kind: "long" }],
      },
      {
        id: "requests",
        title: "Incoming requests from other departments",
        perPerson: false,
        questions: [{ id: "requests", label: "Requests", kind: "long" }],
      },
      {
        id: "questions",
        title: "Questions for the boss",
        description:
          "What's coming in 1–3 months · current top priority · feedback from other departments.",
        perPerson: false,
        questions: [{ id: "questions", label: "Questions", kind: "long" }],
      },
    ],
  },
  {
    name: "Quarterly planning",
    cadence: "Every 3 months",
    durationMinutes: 90,
    participants: "Head + boss (team optional)",
    agendaRules: [],
    extractionInstructions:
      "Extract quarterly priority records (3–5, force-ranked) and their initial high-level tasks. Record resource asks as decision requests.",
    sections: [
      {
        id: "review",
        title: "Quarter in review",
        description: "Delivered + impact.",
        perPerson: false,
        questions: [{ id: "review", label: "Review", kind: "long" }],
      },
      {
        id: "priorities",
        title: "Next quarter's priorities",
        description: "3–5, force-ranked.",
        perPerson: false,
        questions: [{ id: "priorities", label: "Priorities", kind: "long" }],
      },
      {
        id: "resources",
        title: "Resource asks",
        description: "Hiring, equipment, training.",
        perPerson: false,
        questions: [{ id: "asks", label: "Asks", kind: "long" }],
      },
      {
        id: "bets",
        title: "Longer-term bets needing runway",
        perPerson: false,
        questions: [{ id: "bets", label: "Bets", kind: "long" }],
      },
    ],
  },
];
