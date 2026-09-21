"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { objective } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { objectiveSchema } from "@/lib/schemas/meeting";
import { requirePermission } from "@/lib/session";

function revalidate() {
  revalidatePath("/objectives");
  revalidatePath("/board");
  revalidatePath("/dashboard");
}

export async function createObjective(input: unknown) {
  const session = await requirePermission("objective.manage");
  const data = objectiveSchema.parse(input);
  await db.transaction(async (tx) => {
    const [row] = await tx.insert(objective).values(data).returning();
    await logActivity(tx, {
      entityType: "objective",
      entityId: row.id,
      action: "created",
      actorId: session.user.id,
      diff: { title: data.title, week: data.weekStart },
    });
  });
  revalidate();
}

export async function updateObjective(input: unknown) {
  const session = await requirePermission("objective.manage");
  const data = objectiveSchema
    .partial()
    .extend({ id: z.string().uuid() })
    .parse(input);
  const [existing] = await db
    .select()
    .from(objective)
    .where(eq(objective.id, data.id));
  if (!existing) throw new Error("Objective not found");
  const { id, ...changes } = data;
  await db.transaction(async (tx) => {
    await tx
      .update(objective)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(objective.id, id));
    await logActivity(tx, {
      entityType: "objective",
      entityId: id,
      action:
        changes.state && changes.state !== existing.state
          ? `state → ${changes.state}`
          : "updated",
      actorId: session.user.id,
      diff: changes,
    });
  });
  revalidate();
}

export async function deleteObjective(input: unknown) {
  const session = await requirePermission("objective.manage");
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  await db.transaction(async (tx) => {
    await tx.delete(objective).where(eq(objective.id, id)); // tasks keep-null via FK
    await logActivity(tx, {
      entityType: "objective",
      entityId: id,
      action: "deleted",
      actorId: session.user.id,
    });
  });
  revalidate();
}
