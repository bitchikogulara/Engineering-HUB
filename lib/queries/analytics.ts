import "server-only";
import { and, asc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  aiCall,
  boardColumn,
  meeting,
  objective,
  project,
  task,
  taskType,
  user,
} from "@/db/schema";

// FR-45: everything derives from data we already write (ADR-011). Plain SQL
// + a little JS; no analytics vendor.

export type Range = "week" | "month" | "quarter";

export function rangeStart(range: Range, now = new Date()): Date {
  const days = range === "week" ? 7 : range === "month" ? 30 : 90;
  return new Date(now.getTime() - days * 86_400_000);
}

export async function getThroughputByWeek(weeks = 8) {
  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${task.doneAt}), 'MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(task)
    .where(
      and(
        isNotNull(task.doneAt),
        gte(
          task.doneAt,
          sql`now() - interval '${sql.raw(String(weeks))} weeks'`,
        ),
      ),
    )
    .groupBy(sql`date_trunc('week', ${task.doneAt})`)
    .orderBy(sql`date_trunc('week', ${task.doneAt})`);
  return rows;
}

async function completedBy(
  start: Date,
  groupCol: "project" | "type" | "assignee",
) {
  if (groupCol === "project") {
    return db
      .select({
        name: sql<string>`coalesce(${project.name}, 'No project')`,
        n: sql<number>`count(*)::int`,
      })
      .from(task)
      .leftJoin(project, eq(project.id, task.projectId))
      .where(and(isNotNull(task.doneAt), gte(task.doneAt, start)))
      .groupBy(project.name)
      .orderBy(sql`count(*) desc`);
  }
  if (groupCol === "type") {
    return db
      .select({
        name: taskType.name,
        n: sql<number>`count(*)::int`,
      })
      .from(task)
      .innerJoin(taskType, eq(taskType.id, task.typeId))
      .where(and(isNotNull(task.doneAt), gte(task.doneAt, start)))
      .groupBy(taskType.name)
      .orderBy(sql`count(*) desc`);
  }
  return db
    .select({
      name: user.name,
      n: sql<number>`count(*)::int`,
    })
    .from(task)
    .innerJoin(user, eq(user.id, task.assigneeId))
    .where(and(isNotNull(task.doneAt), gte(task.doneAt, start)))
    .groupBy(user.name)
    .orderBy(sql`count(*) desc`);
}

export async function getCompletions(start: Date) {
  const [byProject, byType, byAssignee] = await Promise.all([
    completedBy(start, "project"),
    completedBy(start, "type"),
    completedBy(start, "assignee"),
  ]);
  return { byProject, byType, byAssignee };
}

/** External-request volume by requesting department (FR-45 / hiring case). */
export async function getExternalByDepartment(start: Date) {
  return db
    .select({
      name: sql<string>`coalesce(${task.requesterDepartment}, 'Unknown')`,
      n: sql<number>`count(*)::int`,
    })
    .from(task)
    .innerJoin(taskType, eq(taskType.id, task.typeId))
    .where(and(eq(taskType.isExternal, true), gte(task.createdAt, start)))
    .groupBy(task.requesterDepartment)
    .orderBy(sql`count(*) desc`);
}

/** Time spent blocked, from the append-only activity log. */
export async function getBlockedStats(start: Date) {
  const blockedNames = new Set(
    (
      await db
        .select({ name: boardColumn.name })
        .from(boardColumn)
        .where(eq(boardColumn.isBlocked, true))
    ).map((c) => c.name.toLowerCase()),
  );
  const moves = await db
    .select({
      entityId: activityLog.entityId,
      diff: activityLog.diff,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.entityType, "task"),
        eq(activityLog.action, "moved"),
        gte(activityLog.createdAt, start),
      ),
    )
    .orderBy(asc(activityLog.createdAt));

  let blockedEvents = 0;
  let blockedMs = 0;
  const openSince = new Map<string, number>();
  for (const m of moves) {
    const col = (m.diff as { column?: { from?: string; to?: string } })?.column;
    const to = col?.to?.toLowerCase();
    const from = col?.from?.toLowerCase();
    if (to && blockedNames.has(to)) {
      blockedEvents += 1;
      openSince.set(m.entityId, m.createdAt.getTime());
    } else if (from && blockedNames.has(from) && openSince.has(m.entityId)) {
      blockedMs += m.createdAt.getTime() - (openSince.get(m.entityId) ?? 0);
      openSince.delete(m.entityId);
    }
  }
  const now = Date.now();
  for (const since of openSince.values()) blockedMs += now - since;
  return {
    blockedEvents,
    blockedDays: Math.round((blockedMs / 86_400_000) * 10) / 10,
  };
}

export async function getObjectiveHitRate(start: Date) {
  const [row] = await db
    .select({
      achieved: sql<number>`count(*) filter (where ${objective.state} = 'achieved')::int`,
      missed: sql<number>`count(*) filter (where ${objective.state} = 'missed')::int`,
      rolled: sql<number>`count(*) filter (where ${objective.state} = 'rolled')::int`,
    })
    .from(objective)
    .where(gte(objective.weekStart, start.toISOString().slice(0, 10)));
  return row;
}

/** AI acceptance rate + spend (FR-45; the ≥80 % target from §13). */
export async function getAiStats(start: Date) {
  const meetings = await db
    .select({ appliedResult: meeting.appliedResult })
    .from(meeting)
    .where(and(eq(meeting.status, "confirmed"), gte(meeting.createdAt, start)));
  let applied = 0;
  let rejected = 0;
  for (const m of meetings) {
    const r = m.appliedResult as {
      applied?: Record<string, unknown[]>;
      rejected?: Record<string, unknown[]>;
    } | null;
    applied += Object.values(r?.applied ?? {}).flat().length;
    rejected += Object.values(r?.rejected ?? {}).flat().length;
  }
  const [cost] = await db
    .select({
      usd: sql<number>`coalesce(sum(${aiCall.costUsd}), 0)`,
      calls: sql<number>`count(*)::int`,
    })
    .from(aiCall)
    .where(gte(aiCall.createdAt, start));
  return {
    applied,
    rejected,
    acceptanceRate:
      applied + rejected > 0
        ? Math.round((applied / (applied + rejected)) * 100)
        : null,
    costUsd: Math.round(cost.usd * 100) / 100,
    calls: cost.calls,
  };
}
