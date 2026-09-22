import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  clarificationRound,
  feedbackRound,
  meeting,
  meetingTemplate,
  templateSuggestion,
  user,
} from "@/db/schema";
import { sectionsSchema } from "@/lib/schemas/meeting";
import { callStructured, loadPrompt } from "./client";
import { buildBoardSnapshot, renderMeetingRecord } from "./context";
import {
  type Extraction,
  extractionJsonSchema,
  extractionSchema,
  normalizeExtraction,
  tunerJsonSchema,
  tunerSchema,
} from "./schemas";

// Orchestrates submit → extract → clarify → propose (FR-19..25, FR-46/47).
// Any two consecutive failures leave the meeting in 'pending_processing' with
// a retry button; the record itself is already saved (FR-25).

export type PipelineMode = "extract" | "clarify_rerun" | "revise";

export async function runExtractionPipeline(
  meetingId: string,
  mode: PipelineMode,
): Promise<void> {
  try {
    await db
      .update(meeting)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(meeting.id, meetingId));

    const [row] = await db
      .select({ meeting: meeting, template: meetingTemplate })
      .from(meeting)
      .innerJoin(meetingTemplate, eq(meetingTemplate.id, meeting.templateId))
      .where(eq(meeting.id, meetingId));
    if (!row) throw new Error("Meeting not found");
    const m = row.meeting;
    const template = row.template;
    const sections = sectionsSchema.parse(template.sections);

    const members = await db
      .select({ id: user.id, name: user.name })
      .from(user);
    const participantNames = new Map(members.map((u) => [u.id, u.name]));

    const [snapshot, clarifications, feedback] = await Promise.all([
      buildBoardSnapshot(),
      db
        .select()
        .from(clarificationRound)
        .where(eq(clarificationRound.meetingId, meetingId))
        .orderBy(asc(clarificationRound.round)),
      db
        .select()
        .from(feedbackRound)
        .where(eq(feedbackRound.meetingId, meetingId))
        .orderBy(asc(feedbackRound.round)),
    ]);

    const prompt = loadPrompt("extraction");
    const parts: string[] = [snapshot.text];
    parts.push(
      renderMeetingRecord({
        templateName: template.name,
        date: m.date,
        sections,
        answers: (m.answers ?? {}) as never,
        freeText: m.freeText,
        participantNames,
      }),
    );
    if (template.extractionInstructions) {
      parts.push(
        `## Meeting-type instructions (admin-maintained — follow strictly)\n${template.extractionInstructions}`,
      );
    }
    for (const c of clarifications) {
      const qs = c.questions as { id: string; question: string }[];
      const as = (c.answers ?? {}) as Record<string, string | null>;
      parts.push(
        `## Clarification round ${c.round} (answers override your judgment)\n${qs
          .map(
            (q) =>
              `Q: ${q.question}\nA: ${as[q.id]?.trim() || "(skipped — keep the item, mark needs_attention)"}`,
          )
          .join("\n")}`,
      );
    }
    for (const f of feedback) {
      parts.push(
        `## Reviewer feedback round ${f.round} (apply exactly — this overrides everything above)\n${f.feedback}`,
      );
    }
    if (m.extraction && (mode === "revise" || mode === "clarify_rerun")) {
      parts.push(
        `## Your previous proposal (revise it per the notes above; keep what wasn't criticized)\n${JSON.stringify(m.extraction)}`,
      );
    }

    const extraction = await extractWithRetry({
      meetingId,
      purpose:
        mode === "extract"
          ? "extract"
          : mode === "revise"
            ? "revise"
            : "clarify_rerun",
      promptVersion: prompt.version,
      system: prompt.text,
      userContent: parts.join("\n\n"),
    });

    // Ask clarifications only once, and never after reviewer feedback.
    const askClarifications =
      extraction.clarification_questions.length > 0 &&
      clarifications.length === 0 &&
      feedback.length === 0;

    if (askClarifications) {
      await db.transaction(async (tx) => {
        await tx.insert(clarificationRound).values({
          meetingId,
          round: 1,
          questions: extraction.clarification_questions,
        });
        await tx
          .update(meeting)
          .set({
            extraction,
            summary: extraction.summary,
            status: "clarifying",
            updatedAt: new Date(),
          })
          .where(eq(meeting.id, meetingId));
      });
    } else {
      await db
        .update(meeting)
        .set({
          extraction,
          summary: extraction.summary,
          status: "proposed",
          updatedAt: new Date(),
        })
        .where(eq(meeting.id, meetingId));
    }
  } catch (err) {
    console.error("extraction pipeline failed", err);
    await db
      .update(meeting)
      .set({ status: "pending_processing", updatedAt: new Date() })
      .where(eq(meeting.id, meetingId))
      .catch(() => {});
  }
}

async function extractWithRetry(opts: {
  meetingId: string;
  purpose: "extract" | "revise" | "clarify_rerun";
  promptVersion: string;
  system: string;
  userContent: string;
}): Promise<Extraction> {
  const call = (extra: string) =>
    callStructured({
      purpose: opts.purpose,
      meetingId: opts.meetingId,
      promptVersion: opts.promptVersion,
      system: opts.system,
      userContent: opts.userContent + extra,
      toolName: "submit_extraction",
      toolDescription:
        "Submit the structured extraction of this meeting: summary, new tasks, task updates, objectives, decisions, and clarification questions.",
      inputSchema: extractionJsonSchema as Record<string, unknown>,
    });

  const first = await call("");
  const parsed = extractionSchema.safeParse(normalizeExtraction(first));
  if (parsed.success) return parsed.data;

  // FR-19: one automatic retry on invalid output, with the validation errors.
  const second = await call(
    `\n\n## Your previous output failed validation — fix these issues and resubmit\n${JSON.stringify(parsed.error.issues.slice(0, 10))}`,
  );
  return extractionSchema.parse(normalizeExtraction(second));
}

/** FR-47: propose an instruction edit after a feedback-corrected confirmation. */
export async function runInstructionTuner(meetingId: string): Promise<void> {
  try {
    const [row] = await db
      .select({ meeting: meeting, template: meetingTemplate })
      .from(meeting)
      .innerJoin(meetingTemplate, eq(meetingTemplate.id, meeting.templateId))
      .where(eq(meeting.id, meetingId));
    if (!row) return;

    const feedback = await db
      .select()
      .from(feedbackRound)
      .where(eq(feedbackRound.meetingId, meetingId))
      .orderBy(asc(feedbackRound.round));
    if (feedback.length === 0) return;

    const prompt = loadPrompt("tuner");
    const raw = await callStructured({
      purpose: "tune",
      meetingId,
      promptVersion: prompt.version,
      system: prompt.text,
      userContent: [
        `## Meeting type: ${row.template.name}`,
        `## Current extraction instructions\n${row.template.extractionInstructions ?? "(none)"}`,
        `## Reviewer feedback that was needed this meeting\n${feedback.map((f) => `- ${f.feedback}`).join("\n")}`,
        `## Final accepted result\n${JSON.stringify(row.meeting.appliedResult ?? row.meeting.extraction)}`,
      ].join("\n\n"),
      toolName: "submit_tuning",
      toolDescription:
        "Submit the proposed replacement extraction-instructions block and the rationale for the change.",
      inputSchema: tunerJsonSchema as Record<string, unknown>,
      maxTokens: 2000,
    });
    const tuned = tunerSchema.parse(raw);

    // No-op suggestions are not worth an admin's attention.
    if (
      tuned.proposed_instructions.trim() ===
      (row.template.extractionInstructions ?? "").trim()
    ) {
      return;
    }

    await db.insert(templateSuggestion).values({
      templateId: row.template.id,
      meetingId,
      proposedInstructions: tuned.proposed_instructions,
      rationale: tuned.rationale,
    });
  } catch (err) {
    console.error("instruction tuner failed", err); // advisory — never blocks confirm
  }
}
