import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { boardColumn, meeting, meetingTemplate, task, user } from "@/db/schema";

export type SearchResult = {
  kind: "task" | "meeting";
  id: string;
  title: string;
  snippet: string;
  meta: string;
  href: string;
  archived: boolean;
};

/** Global search across tasks (incl. auto-archived) and meetings (FR-11).
 *  tsvector 'simple' + ILIKE fallback so partial and Georgian terms both hit. */
export async function searchAll(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const ts = sql`websearch_to_tsquery('simple', ${q})`;
  const like = `%${q}%`;

  const tasks = await db
    .select({
      id: task.id,
      displayNumber: task.displayNumber,
      title: task.title,
      description: task.description,
      columnName: boardColumn.name,
      assigneeName: user.name,
      doneAt: task.doneAt,
      rank: sql<number>`ts_rank("task"."search_vector", ${ts})`,
    })
    .from(task)
    .innerJoin(boardColumn, eq(boardColumn.id, task.columnId))
    .innerJoin(user, eq(user.id, task.assigneeId))
    .where(
      sql`"task"."search_vector" @@ ${ts} or ${task.title} ilike ${like} or coalesce(${task.description}, '') ilike ${like}`,
    )
    .orderBy(desc(sql`ts_rank("task"."search_vector", ${ts})`))
    .limit(25);

  const meetings = await db
    .select({
      id: meeting.id,
      date: meeting.date,
      status: meeting.status,
      templateName: meetingTemplate.name,
      freeText: meeting.freeText,
      rank: sql<number>`ts_rank("meeting"."search_vector", ${ts})`,
    })
    .from(meeting)
    .innerJoin(meetingTemplate, eq(meetingTemplate.id, meeting.templateId))
    .where(
      sql`"meeting"."search_vector" @@ ${ts} or coalesce(${meeting.freeText}, '') ilike ${like}`,
    )
    .orderBy(desc(sql`ts_rank("meeting"."search_vector", ${ts})`))
    .limit(25);

  const results: SearchResult[] = [
    ...tasks.map((t) => ({
      kind: "task" as const,
      id: t.id,
      title: `EH-${t.displayNumber} · ${t.title}`,
      snippet: t.description?.slice(0, 140) ?? "",
      meta: `${t.columnName} · ${t.assigneeName.split(" ")[0]}`,
      href: `/board`,
      archived: Boolean(
        t.doneAt && Date.now() - t.doneAt.getTime() > 14 * 86_400_000,
      ),
    })),
    ...meetings.map((m) => ({
      kind: "meeting" as const,
      id: m.id,
      title: `${m.templateName} · ${m.date.toLocaleDateString()}`,
      snippet: m.freeText?.slice(0, 140) ?? "",
      meta: m.status,
      href: `/meetings/${m.id}`,
      archived: false,
    })),
  ];
  return results;
}
