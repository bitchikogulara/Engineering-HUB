"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { boardColumn, project, task, taskType } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";

function revalidateAll() {
  revalidatePath("/board");
  revalidatePath("/admin/board");
}

const columnSchema = z.object({
  name: z.string().trim().min(1).max(60),
  wipHint: z.number().int().min(1).max(20).nullable().optional(),
});

export async function createColumn(input: unknown) {
  const session = await requirePermission("board.configure");
  const data = columnSchema.parse(input);
  const [{ value: maxPos }] = await db
    .select({ value: count() })
    .from(boardColumn);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(boardColumn)
      .values({
        name: data.name,
        position: maxPos + 1,
        wipHint: data.wipHint ?? null,
      })
      .returning();
    await logActivity(tx, {
      entityType: "column",
      entityId: row.id,
      action: "created",
      actorId: session.user.id,
      diff: { name: data.name },
    });
  });
  revalidateAll();
}

export async function renameColumn(input: unknown) {
  const session = await requirePermission("board.configure");
  const { id, name } = z
    .object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60) })
    .parse(input);
  const [existing] = await db
    .select()
    .from(boardColumn)
    .where(eq(boardColumn.id, id));
  if (!existing) throw new Error("Column not found");
  await db.transaction(async (tx) => {
    await tx.update(boardColumn).set({ name }).where(eq(boardColumn.id, id));
    await logActivity(tx, {
      entityType: "column",
      entityId: id,
      action: "renamed",
      actorId: session.user.id,
      diff: { name: { from: existing.name, to: name } },
    });
  });
  revalidateAll();
}

export async function deleteColumn(input: unknown) {
  const session = await requirePermission("board.configure");
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const [colTasks] = await db
    .select({ value: count() })
    .from(task)
    .where(eq(task.columnId, id));
  if (colTasks.value > 0) {
    throw new Error(
      `Column still holds ${colTasks.value} task(s) — move them first.`,
    );
  }
  const [existing] = await db
    .select()
    .from(boardColumn)
    .where(eq(boardColumn.id, id));
  if (!existing) return;
  await db.transaction(async (tx) => {
    await tx.delete(boardColumn).where(eq(boardColumn.id, id));
    await logActivity(tx, {
      entityType: "column",
      entityId: id,
      action: "deleted",
      actorId: session.user.id,
      diff: { name: existing.name },
    });
  });
  revalidateAll();
}

const projectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.number().int().min(1).max(10),
});

export async function createProject(input: unknown) {
  const session = await requirePermission("board.configure");
  const data = projectSchema.parse(input);
  await db.transaction(async (tx) => {
    const [row] = await tx.insert(project).values(data).returning();
    await logActivity(tx, {
      entityType: "project",
      entityId: row.id,
      action: "created",
      actorId: session.user.id,
      diff: { name: data.name },
    });
  });
  revalidateAll();
}

export async function setProjectActive(input: unknown) {
  const session = await requirePermission("board.configure");
  const { id, active } = z
    .object({ id: z.string().uuid(), active: z.boolean() })
    .parse(input);
  await db.transaction(async (tx) => {
    await tx.update(project).set({ active }).where(eq(project.id, id));
    await logActivity(tx, {
      entityType: "project",
      entityId: id,
      action: active ? "activated" : "archived",
      actorId: session.user.id,
    });
  });
  revalidateAll();
}

const typeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.enum(["internal", "service", "print"]),
  icon: z.string().trim().min(1).max(40),
  isExternal: z.boolean(),
});

export async function createTaskType(input: unknown) {
  const session = await requirePermission("board.configure");
  const data = typeSchema.parse(input);
  const [{ value: n }] = await db.select({ value: count() }).from(taskType);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(taskType)
      .values({ ...data, position: n + 1 })
      .returning();
    await logActivity(tx, {
      entityType: "task_type",
      entityId: row.id,
      action: "created",
      actorId: session.user.id,
      diff: { name: data.name, external: data.isExternal },
    });
  });
  revalidateAll();
}

export async function setTaskTypeActive(input: unknown) {
  const session = await requirePermission("board.configure");
  const { id, active } = z
    .object({ id: z.string().uuid(), active: z.boolean() })
    .parse(input);
  await db.transaction(async (tx) => {
    await tx.update(taskType).set({ active }).where(eq(taskType.id, id));
    await logActivity(tx, {
      entityType: "task_type",
      entityId: id,
      action: active ? "activated" : "archived",
      actorId: session.user.id,
    });
  });
  revalidateAll();
}
