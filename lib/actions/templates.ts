"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { meetingTemplate } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { sectionsSchema } from "@/lib/schemas/meeting";
import { requirePermission } from "@/lib/session";

const editSchema = z.object({
  baseId: z.string().uuid(),
  extractionInstructions: z.string().max(10_000).nullable(),
  durationMinutes: z.number().int().min(5).max(240).nullable(),
  scheduleDow: z.array(z.number().int().min(1).max(7)).max(7),
  scheduleTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  scheduleEnabled: z.boolean(),
  sections: z.unknown(),
});

/** FR-13: templates are immutable versions — every save creates version N+1. */
export async function saveTemplateVersion(input: unknown) {
  const session = await requirePermission("template.edit");
  const data = editSchema.parse(input);
  const sections = sectionsSchema.parse(data.sections);

  const [current] = await db
    .select()
    .from(meetingTemplate)
    .where(
      and(
        eq(meetingTemplate.baseId, data.baseId),
        eq(meetingTemplate.active, true),
      ),
    )
    .orderBy(desc(meetingTemplate.version))
    .limit(1);
  if (!current) throw new Error("Template not found");

  await db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ version: meetingTemplate.version })
      .from(meetingTemplate)
      .where(eq(meetingTemplate.baseId, data.baseId))
      .orderBy(desc(meetingTemplate.version))
      .limit(1);
    await tx
      .update(meetingTemplate)
      .set({ active: false })
      .where(eq(meetingTemplate.baseId, data.baseId));
    const [created] = await tx
      .insert(meetingTemplate)
      .values({
        baseId: current.baseId,
        version: (latest?.version ?? current.version) + 1,
        name: current.name,
        cadence: current.cadence,
        durationMinutes: data.durationMinutes,
        participants: current.participants,
        reminderOffsets: current.reminderOffsets,
        scheduleDow: data.scheduleDow,
        scheduleTime: data.scheduleTime,
        monthlyLast: current.monthlyLast,
        scheduleEnabled: data.scheduleEnabled,
        sections,
        agendaRules: current.agendaRules,
        extractionInstructions: data.extractionInstructions,
        active: true,
      })
      .returning();
    await logActivity(tx, {
      entityType: "meeting",
      entityId: created.id,
      action: "template edited",
      actorId: session.user.id,
      diff: { template: current.name, version: created.version },
    });
  });
  revalidatePath("/admin/templates");
  revalidatePath("/meetings");
}
