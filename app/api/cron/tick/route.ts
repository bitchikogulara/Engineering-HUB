import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { meeting, meetingTemplate, reminderSent, task } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { activeTeamIds, notifyUsers } from "@/lib/notifications";
import { nextOccurrence, occurrenceToday, tzParts } from "@/lib/schedule";

// pg_cron calls this every 5 minutes (ADR-005). Idempotent: reminder_sent's
// unique index guarantees one reminder per (template, occurrence, kind) even
// if ticks overlap.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (
    !serverEnv().CRON_SECRET ||
    auth !== `Bearer ${serverEnv().CRON_SECRET}`
  ) {
    return new Response("unauthorized", { status: 401 });
  }
  const now = new Date();
  const actions: string[] = [];

  const templates = await db
    .select()
    .from(meetingTemplate)
    .where(eq(meetingTemplate.active, true));
  const team = await activeTeamIds();

  // --- 15-minutes-before reminders (FR-40) ---
  for (const t of templates) {
    const next = nextOccurrence(t, now);
    if (!next) continue;
    const minutesUntil = (next.getTime() - now.getTime()) / 60_000;
    const offset = t.reminderOffsets[0] ?? 15;
    if (minutesUntil > offset || minutesUntil < 0) continue;
    const inserted = await db
      .insert(reminderSent)
      .values({ templateBaseId: t.baseId, occursAt: next, kind: "before" })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) continue; // already sent
    await notifyUsers(team, {
      kind: "reminder",
      title: `${t.name} starts at ${t.scheduleTime}`,
      body: "Open the meeting form and start when everyone is ready.",
      href: "/meetings",
    });
    actions.push(`reminder:${t.name}`);
  }

  // --- morning digest at 08:30 local (FR-40) ---
  const p = tzParts(now);
  if (p.minutes >= 8 * 60 + 30 && p.minutes < 8 * 60 + 45) {
    const digestKey = new Date(
      Date.UTC(p.y, p.m - 1, p.day, 4, 30), // 08:30 Tbilisi as UTC instant
    );
    const inserted = await db
      .insert(reminderSent)
      .values({
        templateBaseId: "00000000-0000-0000-0000-000000000000",
        occursAt: digestKey,
        kind: "digest",
      })
      .onConflictDoNothing()
      .returning();
    if (inserted.length > 0) {
      const todaysMeetings = templates
        .map((t) => ({ t, at: occurrenceToday(t, now) }))
        .filter((x) => x.at !== null)
        .map((x) => `${x.t.name} ${x.t.scheduleTime}`);
      const [overdue] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(task)
        .where(and(isNull(task.doneAt), lt(task.dueDate, sql`current_date`)));
      await notifyUsers(team, {
        kind: "digest",
        title: "Good morning — today's plan",
        body: [
          todaysMeetings.length
            ? `Meetings: ${todaysMeetings.join(", ")}`
            : "No meetings scheduled today.",
          overdue.n > 0 ? `${overdue.n} task(s) overdue.` : null,
        ]
          .filter(Boolean)
          .join(" "),
        href: "/dashboard",
      });
      actions.push("digest");
    }
  }

  // --- unstick meetings stuck in 'processing' (crashed function) ---
  const stuck = await db
    .select({ id: meeting.id })
    .from(meeting)
    .where(
      and(
        eq(meeting.status, "processing"),
        lt(meeting.updatedAt, new Date(now.getTime() - 10 * 60_000)),
      ),
    )
    .orderBy(desc(meeting.updatedAt));
  for (const m of stuck) {
    await db
      .update(meeting)
      .set({ status: "pending_processing", updatedAt: new Date() })
      .where(and(eq(meeting.id, m.id), gte(sql`1`, sql`1`)));
    actions.push(`unstuck:${m.id}`);
  }

  return Response.json({ ok: true, actions });
}
