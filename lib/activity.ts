import "server-only";
import type { Db } from "@/db";
import { activityLog } from "@/db/schema";

// Anything with the database's insert surface: the db itself or a transaction.
type Tx = Pick<Db, "insert">;

export type ActivityEntry = {
  entityType: "task" | "column" | "project" | "task_type" | "user";
  entityId: string;
  action: string;
  actorType?: "user" | "ai";
  actorId: string;
  diff?:
    | Record<string, { from: unknown; to: unknown }>
    | Record<string, unknown>;
};

/** Writes an audit entry inside the caller's transaction (FR-7, FR-32). */
export async function logActivity(tx: Tx, entry: ActivityEntry): Promise<void> {
  await tx.insert(activityLog).values({
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    actorType: entry.actorType ?? "user",
    actorId: entry.actorId,
    diff: entry.diff ?? null,
  });
}

/** Diff of two flat records, keeping only changed fields. */
export function diffOf(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diff[key] = { from, to };
    }
  }
  return diff;
}
