import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  boardColumn,
  decision,
  meeting,
  meetingTemplate,
  objective,
  quarterlyPriority,
  task,
  user,
} from "@/db/schema";
import {
  isOccurrenceOverdue,
  nextOccurrence,
  occurrenceToday,
  quarterOf,
} from "@/lib/schedule";
import { STALE_AFTER_DAYS } from "@/lib/task-rules";

export async function getColumnCounts() {
  const rows = await db
    .select({
      id: boardColumn.id,
      name: boardColumn.name,
      isBlocked: boardColumn.isBlocked,
      isDone: boardColumn.isDone,
      position: boardColumn.position,
      count: sql<number>`count(${task.id})::int`,
    })
    .from(boardColumn)
    .leftJoin(task, and(eq(task.columnId, boardColumn.id), isNull(task.doneAt)))
    .groupBy(boardColumn.id)
    .orderBy(asc(boardColumn.position));
  // Blocked first (FR-27)
  return rows.sort(
    (a, b) =>
      Number(b.isBlocked) - Number(a.isBlocked) || a.position - b.position,
  );
}

const taskRow = () => ({
  id: task.id,
  displayNumber: task.displayNumber,
  title: task.title,
  assigneeName: user.name,
  dueDate: task.dueDate,
  blockedReason: task.blockedReason,
});

export async function getOverdueTasks() {
  return db
    .select(taskRow())
    .from(task)
    .innerJoin(user, eq(user.id, task.assigneeId))
    .where(and(isNull(task.doneAt), lt(task.dueDate, sql`current_date`)))
    .orderBy(asc(task.dueDate))
    .limit(10);
}

export async function getStaleTasks() {
  return db
    .select(taskRow())
    .from(task)
    .innerJoin(user, eq(user.id, task.assigneeId))
    .where(
      and(
        isNull(task.doneAt),
        lt(
          task.lastActivityAt,
          sql`now() - interval '${sql.raw(String(STALE_AFTER_DAYS))} days'`,
        ),
      ),
    )
    .orderBy(asc(task.lastActivityAt))
    .limit(10);
}

export async function getDueNext7Days() {
  return db
    .select(taskRow())
    .from(task)
    .innerJoin(user, eq(user.id, task.assigneeId))
    .where(
      and(
        isNull(task.doneAt),
        gte(task.dueDate, sql`current_date`),
        lte(task.dueDate, sql`current_date + interval '7 days'`),
      ),
    )
    .orderBy(asc(task.dueDate))
    .limit(10);
}

export async function getDeliveredRecently(limit = 8) {
  return db
    .select({
      id: task.id,
      displayNumber: task.displayNumber,
      title: task.title,
      doneAt: task.doneAt,
      assigneeName: user.name,
    })
    .from(task)
    .innerJoin(user, eq(user.id, task.assigneeId))
    .where(isNotNull(task.doneAt))
    .orderBy(desc(task.doneAt))
    .limit(limit);
}

export async function getRecentDecisions(limit = 6) {
  return db
    .select()
    .from(decision)
    .orderBy(desc(decision.date), desc(decision.createdAt))
    .limit(limit);
}

/** Next occurrence + overdue flag per scheduled meeting type (FR-40). */
export async function getUpcomingMeetings(now = new Date()) {
  const templates = await db
    .select()
    .from(meetingTemplate)
    .where(eq(meetingTemplate.active, true));

  const result: {
    baseId: string;
    name: string;
    nextAt: string | null;
    overdue: boolean;
  }[] = [];
  for (const t of templates) {
    const next = nextOccurrence(t, now);
    const today = occurrenceToday(t, now);
    let overdue = false;
    if (today) {
      const [started] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(meeting)
        .innerJoin(meetingTemplate, eq(meetingTemplate.id, meeting.templateId))
        .where(
          and(
            eq(meetingTemplate.baseId, t.baseId), // any template version counts
            gte(meeting.createdAt, sql`date_trunc('day', now())`),
          ),
        );
      overdue = isOccurrenceOverdue(today, now, started.n > 0);
    }
    result.push({
      baseId: t.baseId,
      name: t.name,
      nextAt: next?.toISOString() ?? null,
      overdue,
    });
  }
  return result
    .filter((r) => r.nextAt !== null || r.overdue)
    .sort((a, b) => (a.nextAt ?? "").localeCompare(b.nextAt ?? ""));
}

/** FR-9: quarter progress = share of linked weekly objectives achieved. */
export async function getQuarterProgress(now = new Date()) {
  const quarter = quarterOf(now);
  const priorities = await db
    .select({
      id: quarterlyPriority.id,
      title: quarterlyPriority.title,
      rank: quarterlyPriority.rank,
      total: sql<number>`count(${objective.id})::int`,
      achieved: sql<number>`count(*) filter (where ${objective.state} = 'achieved')::int`,
    })
    .from(quarterlyPriority)
    .leftJoin(
      objective,
      eq(objective.quarterlyPriorityId, quarterlyPriority.id),
    )
    .where(eq(quarterlyPriority.quarter, quarter))
    .groupBy(quarterlyPriority.id)
    .orderBy(asc(quarterlyPriority.rank));
  return { quarter, priorities };
}
