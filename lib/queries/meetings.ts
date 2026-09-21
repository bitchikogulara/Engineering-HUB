import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  boardColumn,
  meeting,
  meetingTemplate,
  objective,
  suggestionDismissal,
  task,
  user,
} from "@/db/schema";
import type { ContextQuery, TemplateSection } from "@/lib/schemas/meeting";
import { STALE_AFTER_DAYS } from "@/lib/task-rules";

export async function getActiveTemplates() {
  return db
    .select()
    .from(meetingTemplate)
    .where(eq(meetingTemplate.active, true))
    .orderBy(asc(meetingTemplate.name));
}

export async function getRecentMeetings(limit = 30) {
  return db
    .select({
      id: meeting.id,
      date: meeting.date,
      status: meeting.status,
      templateName: meetingTemplate.name,
      createdByName: user.name,
    })
    .from(meeting)
    .innerJoin(meetingTemplate, eq(meetingTemplate.id, meeting.templateId))
    .innerJoin(user, eq(user.id, meeting.createdById))
    .orderBy(desc(meeting.date))
    .limit(limit);
}

export async function getMeetingWithTemplate(id: string) {
  const [row] = await db
    .select({ meeting, template: meetingTemplate })
    .from(meeting)
    .innerJoin(meetingTemplate, eq(meetingTemplate.id, meeting.templateId))
    .where(eq(meeting.id, id));
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Auto-loaded board context per template section (FR-14) — deterministic SQL.
// ---------------------------------------------------------------------------

export type ContextCard = {
  id: string;
  displayNumber: number;
  title: string;
  columnName: string;
  assigneeName: string;
  blockedReason: string | null;
  dueDate: string | null;
};

const contextSelect = () => ({
  id: task.id,
  displayNumber: task.displayNumber,
  title: task.title,
  columnName: boardColumn.name,
  assigneeName: user.name,
  blockedReason: task.blockedReason,
  dueDate: task.dueDate,
});

function baseContextQuery() {
  return db
    .select(contextSelect())
    .from(task)
    .innerJoin(boardColumn, eq(boardColumn.id, task.columnId))
    .innerJoin(user, eq(user.id, task.assigneeId));
}

export async function runContextQuery(
  query: ContextQuery,
  opts: { userId?: string } = {},
): Promise<ContextCard[]> {
  switch (query) {
    case "my_open_tasks":
      return baseContextQuery()
        .where(
          and(
            isNull(task.doneAt),
            opts.userId ? eq(task.assigneeId, opts.userId) : undefined,
            or(
              eq(boardColumn.isBlocked, true),
              sql`${boardColumn.name} ilike '%progress%'`,
            ),
          ),
        )
        .orderBy(asc(task.position));
    case "blocked_tasks":
      return baseContextQuery()
        .where(and(isNull(task.doneAt), eq(boardColumn.isBlocked, true)))
        .orderBy(asc(task.position));
    case "stale_tasks":
      return baseContextQuery()
        .where(
          and(
            isNull(task.doneAt),
            lt(
              task.lastActivityAt,
              sql`now() - interval '${sql.raw(String(STALE_AFTER_DAYS))} days'`,
            ),
          ),
        )
        .orderBy(asc(task.lastActivityAt));
    case "overdue_tasks":
      return baseContextQuery()
        .where(and(isNull(task.doneAt), lt(task.dueDate, sql`current_date`)))
        .orderBy(asc(task.dueDate));
    case "unfinished_tasks":
      return baseContextQuery()
        .where(
          and(
            isNull(task.doneAt),
            lt(task.createdAt, sql`date_trunc('week', now())`),
          ),
        )
        .orderBy(asc(task.position));
    case "completed_this_week":
      return baseContextQuery()
        .where(gte(task.doneAt, sql`date_trunc('week', now())`))
        .orderBy(desc(task.doneAt));
    case "active_objectives": {
      const rows = await db
        .select({
          id: objective.id,
          title: objective.title,
          ownerName: user.name,
        })
        .from(objective)
        .innerJoin(user, eq(user.id, objective.ownerId))
        .where(eq(objective.state, "active"));
      return rows.map((o, i) => ({
        id: o.id,
        displayNumber: i + 1,
        title: o.title,
        columnName: "Objective",
        assigneeName: o.ownerName,
        blockedReason: null,
        dueDate: null,
      }));
    }
  }
}

export async function getSectionContext(
  sections: TemplateSection[],
  participantIds: string[],
): Promise<Record<string, Record<string, ContextCard[]>>> {
  // { [sectionId]: { [userId or "_"]: cards } }
  const result: Record<string, Record<string, ContextCard[]>> = {};
  for (const section of sections) {
    if (!section.context) continue;
    result[section.id] = {};
    if (section.perPerson) {
      for (const uid of participantIds) {
        result[section.id][uid] = await runContextQuery(section.context, {
          userId: uid,
        });
      }
    } else {
      result[section.id]._ = await runContextQuery(section.context);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Agenda suggestions (FR-41): rule-based chips, dismissals suppress 7 days.
// ---------------------------------------------------------------------------

export type AgendaSuggestion = {
  key: string;
  source: string;
  text: string;
};

export async function getAgendaSuggestions(
  rules: string[],
): Promise<AgendaSuggestion[]> {
  const suggestions: AgendaSuggestion[] = [];
  for (const rule of rules) {
    const cards = await runContextQuery(rule as ContextQuery).catch(() => []);
    for (const c of cards) {
      suggestions.push({
        key: `${rule}:${c.id}`,
        source: rule.replaceAll("_", " "),
        text:
          rule === "blocked_tasks" && c.blockedReason
            ? `EH-${c.displayNumber} ${c.title} — blocked: ${c.blockedReason}`
            : `EH-${c.displayNumber} ${c.title}`,
      });
    }
  }
  if (suggestions.length === 0) return [];
  const dismissed = await db
    .select({ key: suggestionDismissal.key })
    .from(suggestionDismissal)
    .where(
      and(
        inArray(
          suggestionDismissal.key,
          suggestions.map((s) => s.key),
        ),
        gte(suggestionDismissal.dismissedUntil, sql`now()`),
      ),
    );
  const dismissedKeys = new Set(dismissed.map((d) => d.key));
  return suggestions.filter((s) => !dismissedKeys.has(s.key));
}
