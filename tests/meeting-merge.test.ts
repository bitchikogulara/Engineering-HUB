import { describe, expect, it } from "vitest";
import { mergeAnswerPatches } from "@/lib/meeting-merge";
import type { MeetingAnswers } from "@/lib/schemas/meeting";

const perPersonBySection = new Map([
  ["progress", true], // per-person section
  ["agenda", false], // shared section
]);

const patch = (
  sectionId: string,
  personKey: string,
  questionId: string,
  value: string,
) => ({ sectionId, personKey, questionId, value });

describe("mergeAnswerPatches (live co-editing, ADR-007)", () => {
  it("applies a member's patch to their own per-person field", () => {
    const { answers, applied } = mergeAnswerPatches(
      {},
      [patch("progress", "u1", "q1", "shipped the thing")],
      { userId: "u1", isAdmin: false, perPersonBySection },
    );
    expect(applied).toBe(1);
    expect(answers.progress.u1.q1).toBe("shipped the thing");
  });

  it("drops a member's patch aimed at someone else's per-person field", () => {
    const current: MeetingAnswers = { progress: { u2: { q1: "original" } } };
    const { answers, applied } = mergeAnswerPatches(
      current,
      [patch("progress", "u2", "q1", "overwritten")],
      { userId: "u1", isAdmin: false, perPersonBySection },
    );
    expect(applied).toBe(0);
    expect(answers.progress.u2.q1).toBe("original");
  });

  it("lets an admin fill in for an absent teammate", () => {
    const { answers, applied } = mergeAnswerPatches(
      {},
      [patch("progress", "u2", "q1", "on leave — no update")],
      { userId: "u1", isAdmin: true, perPersonBySection },
    );
    expect(applied).toBe(1);
    expect(answers.progress.u2.q1).toBe("on leave — no update");
  });

  it("anyone can write shared sections", () => {
    const { applied } = mergeAnswerPatches(
      {},
      [patch("agenda", "_", "q1", "discuss printer queue")],
      { userId: "u1", isAdmin: false, perPersonBySection },
    );
    expect(applied).toBe(1);
  });

  it("never writes into a section the template does not define", () => {
    const { answers, applied } = mergeAnswerPatches(
      {},
      [patch("bogus", "u1", "q1", "x")],
      { userId: "u1", isAdmin: false, perPersonBySection },
    );
    expect(applied).toBe(0);
    expect(answers).toEqual({});
  });

  it("merges concurrent edits without clobbering: only patched fields change", () => {
    // u2 saved first; u1's save carries only u1's patches and must not
    // disturb u2's answers even though u1's client never saw them.
    const afterU2: MeetingAnswers = { progress: { u2: { q1: "u2 update" } } };
    const { answers } = mergeAnswerPatches(
      afterU2,
      [patch("progress", "u1", "q1", "u1 update")],
      { userId: "u1", isAdmin: false, perPersonBySection },
    );
    expect(answers.progress.u2.q1).toBe("u2 update");
    expect(answers.progress.u1.q1).toBe("u1 update");
  });

  it("does not mutate the input object", () => {
    const current: MeetingAnswers = { agenda: { _: { q1: "a" } } };
    mergeAnswerPatches(current, [patch("agenda", "_", "q1", "b")], {
      userId: "u1",
      isAdmin: false,
      perPersonBySection,
    });
    expect(current.agenda._.q1).toBe("a");
  });
});
