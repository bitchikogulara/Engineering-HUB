import "server-only";
import { asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  boardColumn,
  objective,
  project,
  task,
  taskType,
  user,
} from "@/db/schema";
import type { MeetingAnswers, TemplateSection } from "@/lib/schemas/meeting";

// Builds the textual board context the extractor sees (FR-19). Deterministic,
// compact, and name-based — the model reasons over names and EH-numbers; the
// apply step resolves them back to ids.

export type BoardSnapshot = {
  text: string;
  members: { id: string; name: string }[];
  columns: { id: string; name: string; isBlocked: boolean; isDone: boolean }[];
  projects: { id: string; name: string }[];
  types: { id: string; name: string; isExternal: boolean }[];
  objectives: { id: string; title: string; state: string }[];
  openTasks: { id: string; displayNumber: number }[];
};

export async function buildBoardSnapshot(): Promise<BoardSnapshot> {
  const [members, columns, projects, types, objectives_, openTasks] =
    await Promise.all([
      db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(eq(user.active, true)),
      db.select().from(boardColumn).orderBy(asc(boardColumn.position)),
      db.select().from(project).where(eq(project.active, true)),
      db.select().from(taskType).where(eq(taskType.active, true)),
      db.select().from(objective).orderBy(asc(objective.weekStart)),
      db
        .select({
          id: task.id,
          displayNumber: task.displayNumber,
          title: task.title,
          columnId: task.columnId,
          assigneeId: task.assigneeId,
          blockedReason: task.blockedReason,
          dueDate: task.dueDate,
        })
        .from(task)
        .where(isNull(task.doneAt))
        .orderBy(asc(task.displayNumber)),
    ]);

  const columnName = new Map(columns.map((c) => [c.id, c.name]));
  const memberName = new Map(members.map((m) => [m.id, m.name]));

  const lines: string[] = [];
  lines.push(
    `## Board state (today: ${new Date().toISOString().slice(0, 10)})`,
  );
  lines.push(`Team members: ${members.map((m) => m.name).join(", ")}`);
  lines.push(`Columns: ${columns.map((c) => c.name).join(" → ")}`);
  lines.push(
    `Blocked column: ${columns.find((c) => c.isBlocked)?.name ?? "—"} · Done column: ${columns.find((c) => c.isDone)?.name ?? "—"}`,
  );
  lines.push(`Projects: ${projects.map((p) => p.name).join(", ") || "—"}`);
  lines.push(
    `Task types: ${types.map((t) => `${t.name}${t.isExternal ? " (external)" : ""}`).join(", ")}`,
  );
  const activeObjectives = objectives_.filter(
    (o) => o.state === "active" || o.state === "planned",
  );
  lines.push(
    `Objectives: ${activeObjectives.map((o) => `"${o.title}" (${o.state})`).join(", ") || "—"}`,
  );
  lines.push("");
  lines.push("### Open tasks");
  if (openTasks.length === 0) lines.push("(none)");
  for (const t of openTasks) {
    lines.push(
      `- EH-${t.displayNumber} "${t.title}" · ${columnName.get(t.columnId)} · ${memberName.get(t.assigneeId)?.split(" ")[0] ?? "?"}${t.blockedReason ? ` · blocked: ${t.blockedReason}` : ""}${t.dueDate ? ` · due ${t.dueDate}` : ""}`,
    );
  }

  return {
    text: lines.join("\n"),
    members,
    columns: columns.map((c) => ({
      id: c.id,
      name: c.name,
      isBlocked: c.isBlocked,
      isDone: c.isDone,
    })),
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    types: types.map((t) => ({
      id: t.id,
      name: t.name,
      isExternal: t.isExternal,
    })),
    objectives: objectives_.map((o) => ({
      id: o.id,
      title: o.title,
      state: o.state,
    })),
    openTasks: openTasks.map((t) => ({
      id: t.id,
      displayNumber: t.displayNumber,
    })),
  };
}

export function renderMeetingRecord(opts: {
  templateName: string;
  date: Date;
  sections: TemplateSection[];
  answers: MeetingAnswers;
  freeText: string | null;
  participantNames: Map<string, string>;
}): string {
  const lines: string[] = [];
  lines.push(
    `## Meeting record: ${opts.templateName} · ${opts.date.toISOString().slice(0, 10)}`,
  );
  for (const section of opts.sections) {
    const bySection = opts.answers[section.id];
    if (!bySection) continue;
    lines.push(`\n### ${section.title}`);
    for (const [personKey, byQuestion] of Object.entries(bySection)) {
      if (section.perPerson) {
        lines.push(`\n[${opts.participantNames.get(personKey) ?? personKey}]`);
      }
      for (const q of section.questions) {
        const value = byQuestion[q.id]?.trim();
        if (!value) continue;
        lines.push(`${q.label}: ${value}`);
      }
    }
  }
  if (opts.freeText?.trim()) {
    lines.push(`\n### Additional notes\n${opts.freeText.trim()}`);
  }
  return lines.join("\n");
}
