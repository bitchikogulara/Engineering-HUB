import { describe, expect, it } from "vitest";
import { extractionSchema, tunerSchema } from "@/ai/schemas";

// Mandatory per spec: AI JSON schema validation, including mixed
// Georgian/English content (FR-19, FR-37).

const validItemBase = {
  source_quote: "Nikoloz will print the enclosure brackets",
  confidence: "high" as const,
  needs_attention: false,
};

const validExtraction = {
  summary:
    "The team reviewed printing work for the service department and unblocked the CAN reader task.",
  tasks_new: [
    {
      ...validItemBase,
      title: "Print 4x enclosure brackets",
      description: null,
      assignee: "Nikoloz",
      project: null,
      objective: null,
      type: "Print job",
      column: null,
      blocked_reason: null,
      priority: "p2" as const,
      estimate: "s" as const,
      due_date: "2026-09-25",
      requester_name: "G. Beridze",
      requester_department: "Service",
      labels: ["hardware"],
    },
  ],
  tasks_update: [
    {
      ...validItemBase,
      task_number: 12,
      column: "In progress",
      assignee: null,
      priority: null,
      due_date: null,
      blocked_reason: null,
      note: "Unblocked — transceiver arrived",
    },
  ],
  objectives: [
    {
      ...validItemBase,
      action: "update" as const,
      title: "Ship FaceGate v1.4 to the pilot door",
      state: "achieved" as const,
      owner: null,
      week_start: null,
    },
  ],
  decisions: [
    {
      ...validItemBase,
      text: "Standardise on SocketCAN for all CAN interfaces",
      context: "slcan kept dropping the socket on idle",
    },
  ],
  clarification_questions: [],
};

describe("extraction schema (FR-19)", () => {
  it("accepts a fully valid extraction", () => {
    expect(extractionSchema.safeParse(validExtraction).success).toBe(true);
  });

  it("accepts mixed Georgian/English content (FR-37)", () => {
    const georgian = {
      ...validExtraction,
      summary: "გუნდმა განიხილა ბეჭდვის სამუშაოები სერვისისთვის.",
      tasks_new: [
        {
          ...validExtraction.tasks_new[0],
          title: "დაბეჭდე 4 კრონშტეინი diagnostics rig-ისთვის",
          source_quote: "სერვისმა მოგვწერა — 4 ცალი bracket გვჭირდება",
        },
      ],
    };
    expect(extractionSchema.safeParse(georgian).success).toBe(true);
  });

  it("rejects missing source quotes (FR-20)", () => {
    const noQuote = {
      ...validExtraction,
      tasks_new: [{ ...validExtraction.tasks_new[0], source_quote: "" }],
    };
    expect(extractionSchema.safeParse(noQuote).success).toBe(false);
  });

  it("rejects more than 5 clarification questions (FR-21)", () => {
    const tooMany = {
      ...validExtraction,
      clarification_questions: Array.from({ length: 6 }, (_, i) => ({
        id: `q${i}`,
        question: `Question ${i}?`,
      })),
    };
    expect(extractionSchema.safeParse(tooMany).success).toBe(false);
  });

  it("rejects invalid priorities, dates, and confidence values", () => {
    for (const patch of [
      { priority: "urgent" },
      { due_date: "25-09-2026" },
      { confidence: "certain" },
    ]) {
      const bad = {
        ...validExtraction,
        tasks_new: [{ ...validExtraction.tasks_new[0], ...patch }],
      };
      expect(extractionSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects task updates without a task number", () => {
    const bad = {
      ...validExtraction,
      tasks_update: [
        { ...validExtraction.tasks_update[0], task_number: undefined },
      ],
    };
    expect(extractionSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a missing summary", () => {
    expect(
      extractionSchema.safeParse({ ...validExtraction, summary: "" }).success,
    ).toBe(false);
  });
});

describe("tuner schema (FR-47)", () => {
  it("accepts and rejects correctly", () => {
    expect(
      tunerSchema.safeParse({
        proposed_instructions: "Prefer updates over new tasks.",
        rationale: "Reviewer twice merged duplicate proposals.",
      }).success,
    ).toBe(true);
    expect(
      tunerSchema.safeParse({ proposed_instructions: "", rationale: "x" })
        .success,
    ).toBe(false);
  });
});
