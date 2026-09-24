// Pure merge logic for live meeting co-editing (ADR-007). The server applies
// only the fields a client actually changed, and only the fields that client
// is allowed to write — so simultaneous editors can never clobber each other
// and nobody writes into someone else's per-person section.

import type { FieldPatch, MeetingAnswers } from "@/lib/schemas/meeting";

export function mergeAnswerPatches(
  current: MeetingAnswers,
  patches: FieldPatch[],
  opts: {
    userId: string;
    isAdmin: boolean;
    /** sectionId -> perPerson, from the meeting's template. */
    perPersonBySection: Map<string, boolean>;
  },
): { answers: MeetingAnswers; applied: number } {
  const answers = structuredClone(current);
  let applied = 0;
  for (const p of patches) {
    const perPerson = opts.perPersonBySection.get(p.sectionId);
    if (perPerson === undefined) continue; // unknown section — never write
    if (perPerson && p.personKey !== opts.userId && !opts.isAdmin) {
      continue; // not their field — silently dropped
    }
    answers[p.sectionId] ??= {};
    answers[p.sectionId][p.personKey] ??= {};
    answers[p.sectionId][p.personKey][p.questionId] = p.value;
    applied++;
  }
  return { answers, applied };
}
