"use server";

import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callStructured, loadPrompt } from "@/ai/client";
import { db } from "@/db";
import {
  decision,
  meeting,
  meetingTemplate,
  objective,
  task,
  weeklySummary,
} from "@/db/schema";
import { weekStartOf } from "@/lib/schedule";
import { requirePermission } from "@/lib/session";

const summarySchema = z.object({ content: z.string().min(10) });

/** FR-29: auto-draft the current week's summary from meetings + board. */
export async function generateWeeklySummary() {
  const session = await requirePermission("meeting.submit");
  const weekStart = weekStartOf(new Date());
  const since = new Date(`${weekStart}T00:00:00Z`);

  const [meetings, completed, objectives, decisions] = await Promise.all([
    db
      .select({
        name: meetingTemplate.name,
        summary: meeting.summary,
        date: meeting.date,
      })
      .from(meeting)
      .innerJoin(meetingTemplate, eq(meetingTemplate.id, meeting.templateId))
      .where(and(eq(meeting.status, "confirmed"), gte(meeting.date, since))),
    db
      .select({ title: task.title })
      .from(task)
      .where(and(isNotNull(task.doneAt), gte(task.doneAt, since))),
    db
      .select({ title: objective.title, state: objective.state })
      .from(objective)
      .where(gte(objective.weekStart, weekStart)),
    db
      .select({ text: decision.text })
      .from(decision)
      .where(gte(decision.createdAt, since)),
  ]);

  const prompt = loadPrompt("summary");
  const raw = await callStructured({
    purpose: "summary",
    meetingId: null,
    promptVersion: prompt.version,
    system: prompt.text,
    userContent: [
      `Week of ${weekStart}`,
      `## Meeting summaries\n${meetings.map((m) => `- ${m.name} (${m.date.toISOString().slice(0, 10)}): ${m.summary ?? "no summary"}`).join("\n") || "(none)"}`,
      `## Completed tasks\n${completed.map((t) => `- ${t.title}`).join("\n") || "(none)"}`,
      `## Objectives\n${objectives.map((o) => `- ${o.title}: ${o.state}`).join("\n") || "(none)"}`,
      `## Decisions\n${decisions.map((d) => `- ${d.text}`).join("\n") || "(none)"}`,
    ].join("\n\n"),
    toolName: "submit_summary",
    toolDescription: "Submit the weekly summary text.",
    inputSchema: {
      type: "object",
      properties: { content: { type: "string" } },
      required: ["content"],
      additionalProperties: false,
    },
    maxTokens: 1500,
  });
  const { content } = summarySchema.parse(raw);

  const [existing] = await db
    .select()
    .from(weeklySummary)
    .where(eq(weeklySummary.weekStart, weekStart))
    .orderBy(desc(weeklySummary.createdAt))
    .limit(1);
  if (existing) {
    await db
      .update(weeklySummary)
      .set({ content, updatedAt: new Date() })
      .where(eq(weeklySummary.id, existing.id));
  } else {
    await db.insert(weeklySummary).values({
      weekStart,
      content,
      createdById: session.user.id,
    });
  }
  revalidatePath("/summary");
}

export async function saveWeeklySummary(input: unknown) {
  await requirePermission("meeting.submit");
  const { id, content } = z
    .object({ id: z.string().uuid(), content: z.string().min(10).max(20_000) })
    .parse(input);
  await db
    .update(weeklySummary)
    .set({ content, updatedAt: new Date() })
    .where(eq(weeklySummary.id, id));
  revalidatePath("/summary");
}

/** FR-35: share links are token-based and revocable. */
export async function publishSummary(input: unknown) {
  await requirePermission("meeting.submit");
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const token = randomBytes(24).toString("base64url");
  await db
    .update(weeklySummary)
    .set({ shareToken: token, revokedAt: null, updatedAt: new Date() })
    .where(eq(weeklySummary.id, id));
  revalidatePath("/summary");
  return { token };
}

export async function revokeSummary(input: unknown) {
  await requirePermission("meeting.submit");
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  await db
    .update(weeklySummary)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(weeklySummary.id, id));
  revalidatePath("/summary");
}
