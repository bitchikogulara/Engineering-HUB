import "server-only";
import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  boardColumn,
  objective,
  project,
  task,
  taskComment,
  taskType,
  user,
} from "@/db/schema";
import { ARCHIVE_AFTER_DAYS } from "@/lib/task-rules";

// One query layer, many consumers: board view, list view, my-tasks, and the
// phase-2 meeting auto-context queries all read from here.

export type BoardTask = Awaited<ReturnType<typeof getBoardTasks>>[number];

const notArchived = () =>
  or(
    isNull(task.doneAt),
    gt(
      task.doneAt,
      sql`now() - interval '${sql.raw(String(ARCHIVE_AFTER_DAYS))} days'`,
    ),
  );

export async function getBoardTasks() {
  return db
    .select({
      id: task.id,
      displayNumber: task.displayNumber,
      title: task.title,
      description: task.description,
      columnId: task.columnId,
      position: task.position,
      assigneeId: task.assigneeId,
      assigneeName: user.name,
      projectId: task.projectId,
      projectName: project.name,
      projectColor: project.color,
      objectiveId: task.objectiveId,
      objectiveTitle: objective.title,
      typeId: task.typeId,
      typeName: taskType.name,
      typeColor: taskType.color,
      typeIsExternal: taskType.isExternal,
      requesterName: task.requesterName,
      requesterDepartment: task.requesterDepartment,
      priority: task.priority,
      estimate: task.estimate,
      dueDate: task.dueDate,
      blockedReason: task.blockedReason,
      labels: task.labels,
      createdByType: task.createdByType,
      originMeetingId: task.originMeetingId,
      sourceQuote: task.sourceQuote,
      doneAt: task.doneAt,
      lastActivityAt: task.lastActivityAt,
      createdAt: task.createdAt,
    })
    .from(task)
    .innerJoin(user, eq(user.id, task.assigneeId))
    .innerJoin(taskType, eq(taskType.id, task.typeId))
    .leftJoin(project, eq(project.id, task.projectId))
    .leftJoin(objective, eq(objective.id, task.objectiveId))
    .where(notArchived())
    .orderBy(asc(task.position), asc(task.createdAt));
}

export async function getBoardConfig() {
  const [columns, projects, types, members] = await Promise.all([
    db.select().from(boardColumn).orderBy(asc(boardColumn.position)),
    db
      .select()
      .from(project)
      .where(eq(project.active, true))
      .orderBy(asc(project.name)),
    db
      .select()
      .from(taskType)
      .where(eq(taskType.active, true))
      .orderBy(asc(taskType.position)),
    db
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(eq(user.active, true))
      .orderBy(asc(user.name)),
  ]);
  return { columns, projects, types, members };
}

export async function getTaskActivity(taskId: string) {
  return db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      actorType: activityLog.actorType,
      actorId: activityLog.actorId,
      actorName: user.name,
      diff: activityLog.diff,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .leftJoin(user, eq(user.id, activityLog.actorId))
    .where(
      and(eq(activityLog.entityType, "task"), eq(activityLog.entityId, taskId)),
    )
    .orderBy(desc(activityLog.createdAt))
    .limit(50);
}

export async function getTaskComments(taskId: string) {
  return db
    .select({
      id: taskComment.id,
      parentId: taskComment.parentId,
      body: taskComment.body,
      mentions: taskComment.mentions,
      authorId: taskComment.authorId,
      authorName: user.name,
      createdAt: taskComment.createdAt,
    })
    .from(taskComment)
    .innerJoin(user, eq(user.id, taskComment.authorId))
    .where(eq(taskComment.taskId, taskId))
    .orderBy(asc(taskComment.createdAt));
}
