"use server";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { runExtractionPipeline, runInstructionTuner } from "@/ai/pipeline";
import { type Extraction, extractionSchema } from "@/ai/schemas";
import { db } from "@/db";
import {
  boardColumn,
  clarificationRound,
  decision,
  feedbackRound,
  meeting,
  meetingTemplate,
  objective,
  task,
  taskType,
  templateSuggestion,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";
import { assertBlockedMove, assertExternalRequester } from "@/lib/task-rules";

function revalidateMeeting(id: string) {
  revalidatePath(`/meetings/${id}`);
  revalidatePath("/meetings");
  revalidatePath("/board");
  revalidatePath("/dashboard");
}

async function getMeetingOrThrow(id: string) {
  const [m] = await db.select().from(meeting).where(eq(meeting.id, id));
  if (!m) throw new Error("Meeting not found");
  return m;
}

/** FR-21: answer (or skip) the clarification batch → re-extract. */
export async function answerClarifications(input: unknown) {
  await requirePermission("meeting.submit");
  const data = z
    .object({
      meetingId: z.string().uuid(),
      answers: z.record(z.string(), z.string().max(2000).nullable()),
    })
    .parse(input);
  const m = await getMeetingOrThrow(data.meetingId);
  if (m.status !== "clarifying")
    throw new Error("Meeting is not awaiting clarification");

  const [round] = await db
    .select()
    .from(clarificationRound)
    .where(eq(clarificationRound.meetingId, data.meetingId))
    .orderBy(desc(clarificationRound.round))
    .limit(1);
  if (!round) throw new Error("No clarification round found");

  await db
    .update(clarificationRound)
    .set({ answers: data.answers })
    .where(eq(clarificationRound.id, round.id));

  after(() => runExtractionPipeline(data.meetingId, "clarify_rerun"));
  await db
    .update(meeting)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(meeting.id, data.meetingId));
  revalidateMeeting(data.meetingId);
}

/** FR-46: reviewer feedback on the proposal → revised extraction. */
export async function sendProposalFeedback(input: unknown) {
  const session = await requirePermission("meeting.submit");
  const data = z
    .object({
      meetingId: z.string().uuid(),
      feedback: z.string().trim().min(3).max(5000),
    })
    .parse(input);
  const m = await getMeetingOrThrow(data.meetingId);
  if (m.status !== "proposed") throw new Error("Meeting has no open proposal");

  const [{ value: rounds }] = await db
    .select({
      value: sql<number>`coalesce(max(${feedbackRound.round}), 0)::int`,
    })
    .from(feedbackRound)
    .where(eq(feedbackRound.meetingId, data.meetingId));

  await db.insert(feedbackRound).values({
    meetingId: data.meetingId,
    round: rounds + 1,
    feedback: data.feedback,
    givenById: session.user.id,
  });

  after(() => runExtractionPipeline(data.meetingId, "revise"));
  await db
    .update(meeting)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(meeting.id, data.meetingId));
  revalidateMeeting(data.meetingId);
}

/** FR-25: manual retry after a pipeline failure. */
export async function retryProcessing(input: unknown) {
  await requirePermission("meeting.submit");
  const { meetingId } = z.object({ meetingId: z.string().uuid() }).parse(input);
  const m = await getMeetingOrThrow(meetingId);
  if (m.status !== "pending_processing") throw new Error("Nothing to retry");
  after(() => runExtractionPipeline(meetingId, "extract"));
  await db
    .update(meeting)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(meeting.id, meetingId));
  revalidateMeeting(meetingId);
}

// ---------------------------------------------------------------------------
// Confirm (FR-23): apply accepted items in one transaction. The client sends
// accept/reject flags (+ edited fields for new tasks); everything else is
// re-read server-side from the stored extraction — never trusted from the UI.
// ---------------------------------------------------------------------------

const applySchema = z.object({
  meetingId: z.string().uuid(),
  tasksNew: z.array(
    z.object({
      index: z.number().int().min(0),
      accepted: z.boolean(),
      title: z.string().trim().min(1).max(300).optional(),
      assigneeId: z.string().optional(),
      columnId: z.string().uuid().optional(),
      typeId: z.string().uuid().optional(),
      projectId: z.string().uuid().nullable().optional(),
      objectiveId: z.string().uuid().nullable().optional(),
      priority: z.enum(["p1", "p2", "p3"]).optional(),
      requesterName: z.string().max(200).nullable().optional(),
      requesterDepartment: z.string().max(200).nullable().optional(),
    }),
  ),
  tasksUpdate: z.array(
    z.object({ index: z.number().int().min(0), accepted: z.boolean() }),
  ),
  objectives: z.array(
    z.object({ index: z.number().int().min(0), accepted: z.boolean() }),
  ),
  decisions: z.array(
    z.object({ index: z.number().int().min(0), accepted: z.boolean() }),
  ),
});

export async function applyProposal(input: unknown) {
  const session = await requirePermission("proposal.confirm");
  const data = applySchema.parse(input);
  const m = await getMeetingOrThrow(data.meetingId);
  if (m.status !== "proposed") throw new Error("Meeting has no open proposal");
  const extraction = extractionSchema.parse(m.extraction) as Extraction;

  const [columns, types, objectives_] = await Promise.all([
    db.select().from(boardColumn),
    db.select().from(taskType),
    db.select().from(objective),
  ]);

  const defaultColumn =
    columns.find((c) => !c.isDone && !c.isBlocked && c.position > 1) ??
    columns[0];
  const blockedColumnIds = new Set(
    columns.filter((c) => c.isBlocked).map((c) => c.id),
  );
  const internalType = types.find((t) => !t.isExternal) ?? types[0];

  const applied: Record<string, unknown[]> = {
    tasksNew: [],
    tasksUpdate: [],
    objectives: [],
    decisions: [],
  };
  const rejected: Record<string, unknown[]> = {
    tasksNew: [],
    tasksUpdate: [],
    objectives: [],
    decisions: [],
  };

  await db.transaction(async (tx) => {
    // --- new tasks ---
    for (const item of data.tasksNew) {
      const source = extraction.tasks_new[item.index];
      if (!source) continue;
      if (!item.accepted) {
        rejected.tasksNew.push(source);
        continue;
      }
      const typeId = item.typeId ?? internalType.id;
      const type = types.find((t) => t.id === typeId) ?? internalType;
      const requesterName = item.requesterName ?? source.requester_name;
      const requesterDepartment =
        item.requesterDepartment ?? source.requester_department;
      assertExternalRequester(type, requesterName, requesterDepartment);
      if (!item.assigneeId) {
        throw new Error(
          `"${item.title ?? source.title}" has no assignee — pick one before confirming.`,
        );
      }
      const columnId = item.columnId ?? defaultColumn.id;
      const [created] = await tx
        .insert(task)
        .values({
          title: item.title ?? source.title,
          description: source.description,
          columnId,
          position: Date.now() + item.index,
          assigneeId: item.assigneeId,
          projectId: item.projectId ?? null,
          objectiveId: item.objectiveId ?? null,
          typeId,
          requesterName,
          requesterDepartment,
          priority: item.priority ?? source.priority,
          estimate: source.estimate,
          dueDate: source.due_date,
          labels: source.labels,
          createdByType: "ai",
          createdById: session.user.id, // "AI, confirmed by X"
          originMeetingId: data.meetingId,
          sourceQuote: source.source_quote,
          blockedReason: blockedColumnIds.has(columnId)
            ? (source.blocked_reason ?? source.source_quote)
            : null,
        })
        .returning();
      await logActivity(tx, {
        entityType: "task",
        entityId: created.id,
        action: "created",
        actorType: "ai",
        actorId: session.user.id,
        diff: { title: created.title, from_meeting: data.meetingId },
      });
      applied.tasksNew.push({ ...source, taskId: created.id });
    }

    // --- updates to existing tasks ---
    for (const item of data.tasksUpdate) {
      const source = extraction.tasks_update[item.index];
      if (!source) continue;
      if (!item.accepted) {
        rejected.tasksUpdate.push(source);
        continue;
      }
      const [target] = await tx
        .select()
        .from(task)
        .where(
          and(eq(task.displayNumber, source.task_number), isNull(task.doneAt)),
        );
      if (!target) {
        rejected.tasksUpdate.push({ ...source, reason: "task not found" });
        continue;
      }
      const targetColumn = source.column
        ? columns.find(
            (c) => c.name.toLowerCase() === source.column?.toLowerCase(),
          )
        : null;
      if (targetColumn) {
        assertBlockedMove(
          targetColumn,
          source.blocked_reason ?? target.blockedReason,
        );
      }
      await tx
        .update(task)
        .set({
          columnId: targetColumn?.id ?? target.columnId,
          blockedReason: targetColumn
            ? targetColumn.isBlocked
              ? (source.blocked_reason ?? target.blockedReason)
              : null
            : (source.blocked_reason ?? target.blockedReason),
          priority: source.priority ?? target.priority,
          dueDate: source.due_date ?? target.dueDate,
          doneAt: targetColumn?.isDone
            ? (target.doneAt ?? new Date())
            : targetColumn
              ? null
              : target.doneAt,
          updatedAt: new Date(),
          lastActivityAt: new Date(),
        })
        .where(eq(task.id, target.id));
      await logActivity(tx, {
        entityType: "task",
        entityId: target.id,
        action: targetColumn ? "moved" : "updated",
        actorType: "ai",
        actorId: session.user.id,
        diff: {
          ...(targetColumn
            ? {
                column: {
                  from: columns.find((c) => c.id === target.columnId)?.name,
                  to: targetColumn.name,
                },
              }
            : {}),
          from_meeting: data.meetingId,
          note: source.note,
        },
      });
      applied.tasksUpdate.push({ ...source, taskId: target.id });
    }

    // --- objectives ---
    for (const item of data.objectives) {
      const source = extraction.objectives[item.index];
      if (!source) continue;
      if (!item.accepted) {
        rejected.objectives.push(source);
        continue;
      }
      if (source.action === "update") {
        const existing = objectives_.find(
          (o) => o.title.toLowerCase() === source.title.toLowerCase(),
        );
        if (existing && source.state) {
          await tx
            .update(objective)
            .set({ state: source.state, updatedAt: new Date() })
            .where(eq(objective.id, existing.id));
          await logActivity(tx, {
            entityType: "objective",
            entityId: existing.id,
            action: `state → ${source.state}`,
            actorType: "ai",
            actorId: session.user.id,
          });
          applied.objectives.push(source);
          continue;
        }
      }
      const monday = new Date();
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const [created] = await tx
        .insert(objective)
        .values({
          title: source.title,
          weekStart: source.week_start ?? monday.toISOString().slice(0, 10),
          ownerId: session.user.id,
          state: source.state ?? "active",
        })
        .returning();
      await logActivity(tx, {
        entityType: "objective",
        entityId: created.id,
        action: "created",
        actorType: "ai",
        actorId: session.user.id,
        diff: { title: source.title, from_meeting: data.meetingId },
      });
      applied.objectives.push(source);
    }

    // --- decisions ---
    for (const item of data.decisions) {
      const source = extraction.decisions[item.index];
      if (!source) continue;
      if (!item.accepted) {
        rejected.decisions.push(source);
        continue;
      }
      const [created] = await tx
        .insert(decision)
        .values({
          text: source.text,
          context: source.context,
          meetingId: data.meetingId,
          createdByType: "ai",
          createdById: session.user.id,
        })
        .returning();
      await logActivity(tx, {
        entityType: "decision",
        entityId: created.id,
        action: "logged",
        actorType: "ai",
        actorId: session.user.id,
      });
      applied.decisions.push(source);
    }

    // --- freeze the meeting record (FR-18) ---
    await tx
      .update(meeting)
      .set({
        status: "confirmed",
        appliedResult: { applied, rejected },
        updatedAt: new Date(),
      })
      .where(eq(meeting.id, data.meetingId));
    await logActivity(tx, {
      entityType: "meeting",
      entityId: data.meetingId,
      action: "confirmed",
      actorId: session.user.id,
      diff: {
        applied: Object.fromEntries(
          Object.entries(applied).map(([k, v]) => [k, v.length]),
        ),
      },
    });
  });

  after(() => runInstructionTuner(data.meetingId)); // FR-47
  revalidateMeeting(data.meetingId);
  revalidatePath("/objectives");
}

// ---------------------------------------------------------------------------
// FR-47: apply or discard an AI-proposed instruction edit (admin only).
// ---------------------------------------------------------------------------

export async function resolveTemplateSuggestion(input: unknown) {
  const session = await requirePermission("template.edit");
  const { id, apply } = z
    .object({ id: z.string().uuid(), apply: z.boolean() })
    .parse(input);
  const [suggestion] = await db
    .select()
    .from(templateSuggestion)
    .where(eq(templateSuggestion.id, id));
  if (suggestion?.status !== "pending") return;

  if (!apply) {
    await db
      .update(templateSuggestion)
      .set({ status: "discarded" })
      .where(eq(templateSuggestion.id, id));
    revalidatePath("/meetings");
    return;
  }

  const [current] = await db
    .select()
    .from(meetingTemplate)
    .where(eq(meetingTemplate.id, suggestion.templateId));
  if (!current) throw new Error("Template not found");

  await db.transaction(async (tx) => {
    // Templates are immutable versions: applying creates version N+1 (FR-13).
    const [latest] = await tx
      .select()
      .from(meetingTemplate)
      .where(eq(meetingTemplate.baseId, current.baseId))
      .orderBy(desc(meetingTemplate.version))
      .limit(1);
    await tx
      .update(meetingTemplate)
      .set({ active: false })
      .where(eq(meetingTemplate.baseId, current.baseId));
    const [created] = await tx
      .insert(meetingTemplate)
      .values({
        baseId: current.baseId,
        version: (latest?.version ?? current.version) + 1,
        name: current.name,
        cadence: current.cadence,
        durationMinutes: current.durationMinutes,
        participants: current.participants,
        reminderOffsets: current.reminderOffsets,
        sections: current.sections,
        agendaRules: current.agendaRules,
        extractionInstructions: suggestion.proposedInstructions,
        active: true,
      })
      .returning();
    await tx
      .update(templateSuggestion)
      .set({ status: "applied" })
      .where(eq(templateSuggestion.id, id));
    await logActivity(tx, {
      entityType: "meeting",
      entityId: created.id,
      action: "template instructions tuned",
      actorType: "ai",
      actorId: session.user.id,
      diff: { template: current.name, version: created.version },
    });
  });
  revalidatePath("/meetings");
}
