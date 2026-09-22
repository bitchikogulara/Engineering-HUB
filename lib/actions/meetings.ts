"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { runExtractionPipeline } from "@/ai/pipeline";
import { db } from "@/db";
import {
  meeting,
  meetingTemplate,
  suggestionDismissal,
  user,
} from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { saveMeetingSchema, startMeetingSchema } from "@/lib/schemas/meeting";
import { requirePermission } from "@/lib/session";

/** Creates a draft meeting from the active version of a template. */
export async function startMeeting(input: unknown) {
  const session = await requirePermission("meeting.participate");
  const { templateBaseId } = startMeetingSchema.parse(input);

  const [template] = await db
    .select()
    .from(meetingTemplate)
    .where(
      and(
        eq(meetingTemplate.baseId, templateBaseId),
        eq(meetingTemplate.active, true),
      ),
    )
    .orderBy(desc(meetingTemplate.version))
    .limit(1);
  if (!template) throw new Error("Template not found");

  const members = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.active, true)));

  const [created] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(meeting)
      .values({
        templateId: template.id,
        participants: members.map((m) => m.id),
        createdById: session.user.id,
        answers: {},
      })
      .returning();
    await logActivity(tx, {
      entityType: "meeting",
      entityId: rows[0].id,
      action: "started",
      actorId: session.user.id,
      diff: { template: template.name },
    });
    return rows;
  });

  redirect(`/meetings/${created.id}`);
}

/** Autosave (FR-15): drafts persist to the DB, never localStorage. */
export async function saveMeeting(input: unknown) {
  await requirePermission("meeting.participate");
  const data = saveMeetingSchema.parse(input);
  const [existing] = await db
    .select({ status: meeting.status })
    .from(meeting)
    .where(eq(meeting.id, data.id));
  if (!existing) throw new Error("Meeting not found");
  if (existing.status !== "draft") {
    throw new Error("This meeting is already submitted.");
  }
  await db
    .update(meeting)
    .set({
      answers: data.answers,
      freeText: data.freeText ?? null,
      updatedAt: new Date(),
    })
    .where(eq(meeting.id, data.id));
  return { savedAt: new Date().toISOString() };
}

/** Submit (FR-17). Phase 2: the record is saved and browsable; the AI
 *  pipeline takes over from here in phase 3. */
export async function submitMeeting(input: unknown) {
  const session = await requirePermission("meeting.submit");
  const data = saveMeetingSchema.parse(input);
  const [existing] = await db
    .select({ status: meeting.status })
    .from(meeting)
    .where(eq(meeting.id, data.id));
  if (!existing) throw new Error("Meeting not found");
  if (existing.status !== "draft") {
    throw new Error("This meeting is already submitted.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(meeting)
      .set({
        answers: data.answers,
        freeText: data.freeText ?? null,
        status: "submitted",
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(meeting.id, data.id));
    await logActivity(tx, {
      entityType: "meeting",
      entityId: data.id,
      action: "submitted",
      actorId: session.user.id,
    });
  });

  after(() => runExtractionPipeline(data.id, "extract")); // async — submit returns immediately (FR-25)

  revalidatePath("/meetings");
  revalidatePath(`/meetings/${data.id}`);
}

export async function deleteDraftMeeting(input: unknown) {
  const session = await requirePermission("meeting.participate");
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const [existing] = await db
    .select({ status: meeting.status })
    .from(meeting)
    .where(eq(meeting.id, id));
  if (!existing) return;
  if (existing.status !== "draft") {
    throw new Error("Only drafts can be discarded.");
  }
  await db.transaction(async (tx) => {
    await tx.delete(meeting).where(eq(meeting.id, id));
    await logActivity(tx, {
      entityType: "meeting",
      entityId: id,
      action: "draft discarded",
      actorId: session.user.id,
    });
  });
  revalidatePath("/meetings");
}

/** FR-41: dismissing a suggestion suppresses it for 7 days. */
export async function dismissSuggestion(input: unknown) {
  const session = await requirePermission("meeting.participate");
  const { key } = z.object({ key: z.string().min(1).max(200) }).parse(input);
  await db.insert(suggestionDismissal).values({
    key,
    dismissedById: session.user.id,
    dismissedUntil: new Date(Date.now() + 7 * 86_400_000),
  });
}
