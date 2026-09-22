"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { boardColumn, task, taskComment, taskType, user } from "@/db/schema";
import { diffOf, logActivity } from "@/lib/activity";
import { notifyUsers } from "@/lib/notifications";
import {
  commentSchema,
  createTaskSchema,
  moveTaskSchema,
  updateTaskSchema,
} from "@/lib/schemas/task";
import { requirePermission } from "@/lib/session";
import { assertBlockedMove, assertExternalRequester } from "@/lib/task-rules";

function revalidateBoard() {
  revalidatePath("/board");
  revalidatePath("/dashboard");
}

async function getColumnOrThrow(columnId: string) {
  const [col] = await db
    .select()
    .from(boardColumn)
    .where(eq(boardColumn.id, columnId));
  if (!col) throw new Error("Column not found");
  return col;
}

async function getTypeOrThrow(typeId: string) {
  const [t] = await db.select().from(taskType).where(eq(taskType.id, typeId));
  if (!t) throw new Error("Task type not found");
  return t;
}

export async function createTask(input: unknown) {
  const session = await requirePermission("task.create");
  const data = createTaskSchema.parse(input);

  const [column, type] = await Promise.all([
    getColumnOrThrow(data.columnId),
    getTypeOrThrow(data.typeId),
  ]);
  assertExternalRequester(type, data.requesterName, data.requesterDepartment);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(task)
      .values({
        title: data.title,
        description: data.description ?? null,
        columnId: data.columnId,
        position: Date.now(), // append to the end; drags refine ordering
        assigneeId: data.assigneeId,
        projectId: data.projectId ?? null,
        objectiveId: data.objectiveId ?? null,
        typeId: data.typeId,
        requesterName: data.requesterName ?? null,
        requesterDepartment: data.requesterDepartment ?? null,
        priority: data.priority,
        estimate: data.estimate ?? null,
        dueDate: data.dueDate ?? null,
        labels: data.labels,
        createdByType: "user",
        createdById: session.user.id,
        doneAt: column.isDone ? new Date() : null,
      })
      .returning();
    await logActivity(tx, {
      entityType: "task",
      entityId: row.id,
      action: "created",
      actorId: session.user.id,
      diff: { title: row.title, column: column.name },
    });
    return row;
  });

  revalidateBoard();
  return { id: created.id, displayNumber: created.displayNumber };
}

export async function updateTask(input: unknown) {
  const session = await requirePermission("task.edit");
  const data = updateTaskSchema.parse(input);

  const [existing] = await db.select().from(task).where(eq(task.id, data.id));
  if (!existing) throw new Error("Task not found");

  const typeId = data.typeId ?? existing.typeId;
  const type = await getTypeOrThrow(typeId);
  assertExternalRequester(
    type,
    data.requesterName ?? existing.requesterName,
    data.requesterDepartment ?? existing.requesterDepartment,
  );

  const changes = {
    title: data.title ?? existing.title,
    description:
      data.description !== undefined ? data.description : existing.description,
    assigneeId: data.assigneeId ?? existing.assigneeId,
    projectId:
      data.projectId !== undefined ? data.projectId : existing.projectId,
    typeId,
    requesterName:
      data.requesterName !== undefined
        ? data.requesterName
        : existing.requesterName,
    requesterDepartment:
      data.requesterDepartment !== undefined
        ? data.requesterDepartment
        : existing.requesterDepartment,
    priority: data.priority ?? existing.priority,
    estimate: data.estimate !== undefined ? data.estimate : existing.estimate,
    dueDate: data.dueDate !== undefined ? data.dueDate : existing.dueDate,
    labels: data.labels ?? existing.labels,
    blockedReason:
      data.blockedReason !== undefined
        ? data.blockedReason
        : existing.blockedReason,
  };

  const diff = diffOf(
    existing as unknown as Record<string, unknown>,
    changes as unknown as Record<string, unknown>,
  );
  if (Object.keys(diff).length === 0) return { id: existing.id };

  await db.transaction(async (tx) => {
    await tx
      .update(task)
      .set({ ...changes, updatedAt: new Date(), lastActivityAt: new Date() })
      .where(eq(task.id, data.id));
    await logActivity(tx, {
      entityType: "task",
      entityId: data.id,
      action: "updated",
      actorId: session.user.id,
      diff,
    });
  });

  revalidateBoard();
  return { id: data.id };
}

export async function moveTask(input: unknown) {
  const session = await requirePermission("task.move");
  const data = moveTaskSchema.parse(input);

  const [existing] = await db.select().from(task).where(eq(task.id, data.id));
  if (!existing) throw new Error("Task not found");
  const toColumn = await getColumnOrThrow(data.toColumnId);

  // FR-4: blocked column requires a reason (keep an existing one if present)
  const blockedReason = data.blockedReason ?? existing.blockedReason;
  assertBlockedMove(toColumn, blockedReason);

  const columnChanged = existing.columnId !== data.toColumnId;
  const fromColumn = columnChanged
    ? await getColumnOrThrow(existing.columnId)
    : toColumn;

  await db.transaction(async (tx) => {
    await tx
      .update(task)
      .set({
        columnId: data.toColumnId,
        position: data.position,
        blockedReason: toColumn.isBlocked ? blockedReason : null,
        doneAt: toColumn.isDone
          ? (existing.doneAt ?? new Date()) // FR-5: entering Done stamps completion
          : null,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(task.id, data.id));
    if (columnChanged) {
      await logActivity(tx, {
        entityType: "task",
        entityId: data.id,
        action: "moved",
        actorId: session.user.id,
        diff: {
          column: { from: fromColumn.name, to: toColumn.name },
          ...(toColumn.isBlocked
            ? { blockedReason: { from: null, to: blockedReason } }
            : {}),
        },
      });
    }
  });

  revalidateBoard();
  return { id: data.id };
}

export async function deleteTask(input: unknown) {
  const session = await requirePermission("task.delete");
  const { id } = updateTaskSchema.pick({ id: true }).parse(input);
  const [existing] = await db.select().from(task).where(eq(task.id, id));
  if (!existing) return;

  await db.transaction(async (tx) => {
    await tx.delete(task).where(eq(task.id, id));
    await logActivity(tx, {
      entityType: "task",
      entityId: id,
      action: "deleted",
      actorId: session.user.id,
      diff: { title: existing.title },
    });
  });
  revalidateBoard();
}

export async function addComment(input: unknown) {
  const session = await requirePermission("task.comment");
  const data = commentSchema.parse(input);

  // @mentions: match active user names case-insensitively ("@Nikoloz")
  const members = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.active, true));
  const mentions = members
    .filter((m) =>
      data.body
        .toLowerCase()
        .includes(`@${m.name.split(" ")[0].toLowerCase()}`),
    )
    .map((m) => m.id);

  await db.transaction(async (tx) => {
    await tx.insert(taskComment).values({
      taskId: data.taskId,
      authorId: session.user.id,
      parentId: data.parentId ?? null,
      body: data.body,
      mentions,
    });
    await tx
      .update(task)
      .set({ lastActivityAt: new Date() })
      .where(eq(task.id, data.taskId));
    await logActivity(tx, {
      entityType: "task",
      entityId: data.taskId,
      action: "commented",
      actorId: session.user.id,
    });
  });

  const [commented] = await db
    .select({ displayNumber: task.displayNumber })
    .from(task)
    .where(eq(task.id, data.taskId));
  await notifyUsers(
    mentions.filter((id) => id !== session.user.id),
    {
      kind: "mention",
      title: `${session.user.name.split(" ")[0]} mentioned you on EH-${commented?.displayNumber}`,
      body: data.body.slice(0, 140),
      href: "/board",
    },
  );

  revalidateBoard();
}
