import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { objective, task, user } from "@/db/schema";

export type ObjectiveWithProgress = Awaited<
  ReturnType<typeof getObjectives>
>[number];

/** Objectives with live progress (done/total from linked tasks, FR-8). */
export async function getObjectives(opts: { activeOnly?: boolean } = {}) {
  const rows = await db
    .select({
      id: objective.id,
      title: objective.title,
      weekStart: objective.weekStart,
      state: objective.state,
      ownerId: objective.ownerId,
      ownerName: user.name,
      quarterlyPriorityId: objective.quarterlyPriorityId,
      total: sql<number>`count(${task.id})::int`,
      done: sql<number>`count(${task.doneAt})::int`,
    })
    .from(objective)
    .innerJoin(user, eq(user.id, objective.ownerId))
    .leftJoin(task, eq(task.objectiveId, objective.id))
    .where(opts.activeOnly ? eq(objective.state, "active") : undefined)
    .groupBy(objective.id, user.name)
    .orderBy(desc(objective.weekStart), asc(objective.title));
  return rows;
}
