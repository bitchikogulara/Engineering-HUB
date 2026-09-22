import { db } from "@/db";
import {
  boardColumn,
  decision,
  meeting,
  meetingTemplate,
  objective,
  project,
  quarterlyPriority,
  task,
  taskComment,
  taskType,
} from "@/db/schema";
import { requirePermission } from "@/lib/session";

// FR-36: one-click JSON export of everything — data is never trapped here.

export const dynamic = "force-dynamic";

export async function GET() {
  await requirePermission("data.export");
  const [
    tasks,
    comments,
    columns,
    projects,
    types,
    objectives,
    quarters,
    meetings,
    templates,
    decisions,
  ] = await Promise.all([
    db.select().from(task),
    db.select().from(taskComment),
    db.select().from(boardColumn),
    db.select().from(project),
    db.select().from(taskType),
    db.select().from(objective),
    db.select().from(quarterlyPriority),
    db.select().from(meeting),
    db.select().from(meetingTemplate),
    db.select().from(decision),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    tasks,
    comments,
    columns,
    projects,
    taskTypes: types,
    objectives,
    quarterlyPriorities: quarters,
    meetings,
    meetingTemplates: templates,
    decisions,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="engineering-hub-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
