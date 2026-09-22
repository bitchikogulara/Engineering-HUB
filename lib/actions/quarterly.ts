"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { quarterlyPriority } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";

function revalidate() {
  revalidatePath("/objectives");
  revalidatePath("/dashboard");
}

export async function createQuarterlyPriority(input: unknown) {
  const session = await requirePermission("objective.manage");
  const data = z
    .object({
      title: z.string().trim().min(1).max(300),
      quarter: z.string().regex(/^\d{4}-Q[1-4]$/),
      rank: z.number().int().min(1).max(10),
      notes: z.string().max(2000).optional(),
    })
    .parse(input);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(quarterlyPriority)
      .values({ ...data, notes: data.notes || null })
      .returning();
    await logActivity(tx, {
      entityType: "objective",
      entityId: row.id,
      action: "quarterly priority created",
      actorId: session.user.id,
      diff: { title: data.title, quarter: data.quarter },
    });
  });
  revalidate();
}

export async function deleteQuarterlyPriority(input: unknown) {
  const session = await requirePermission("objective.manage");
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  await db.transaction(async (tx) => {
    await tx.delete(quarterlyPriority).where(eq(quarterlyPriority.id, id));
    await logActivity(tx, {
      entityType: "objective",
      entityId: id,
      action: "quarterly priority deleted",
      actorId: session.user.id,
    });
  });
  revalidate();
}
