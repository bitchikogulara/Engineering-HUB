"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { decision } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";

export async function createDecision(input: unknown) {
  const session = await requirePermission("decision.manage");
  const data = z
    .object({
      text: z.string().trim().min(3).max(1000),
      context: z.string().trim().max(2000).optional(),
    })
    .parse(input);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(decision)
      .values({
        text: data.text,
        context: data.context || null,
        createdByType: "user",
        createdById: session.user.id,
      })
      .returning();
    await logActivity(tx, {
      entityType: "decision",
      entityId: row.id,
      action: "logged",
      actorId: session.user.id,
    });
  });
  revalidatePath("/decisions");
  revalidatePath("/dashboard");
}

export async function deleteDecision(input: unknown) {
  const session = await requirePermission("decision.manage");
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  await db.transaction(async (tx) => {
    await tx.delete(decision).where(eq(decision.id, id));
    await logActivity(tx, {
      entityType: "decision",
      entityId: id,
      action: "deleted",
      actorId: session.user.id,
    });
  });
  revalidatePath("/decisions");
}
