import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { quarterlyPriority } from "@/db/schema";
import { hasPermission } from "@/lib/permissions";
import { getBoardConfig } from "@/lib/queries/board";
import { getObjectives } from "@/lib/queries/objectives";
import { quarterOf } from "@/lib/schedule";
import { requireSession } from "@/lib/session";
import { ObjectivesScreen } from "./objectives-screen";

export const metadata: Metadata = { title: "Objectives" };
export const dynamic = "force-dynamic";

export default async function ObjectivesPage() {
  const session = await requireSession();
  const quarter = quarterOf(new Date());
  const [objectives, config, priorities] = await Promise.all([
    getObjectives(),
    getBoardConfig(),
    db
      .select()
      .from(quarterlyPriority)
      .where(eq(quarterlyPriority.quarter, quarter))
      .orderBy(asc(quarterlyPriority.rank)),
  ]);
  return (
    <ObjectivesScreen
      objectives={objectives.map((o) => ({
        id: o.id,
        title: o.title,
        weekStart: o.weekStart,
        state: o.state,
        ownerId: o.ownerId,
        ownerName: o.ownerName,
        quarterlyPriorityId: o.quarterlyPriorityId,
        done: o.done,
        total: o.total,
      }))}
      members={config.members}
      quarter={quarter}
      priorities={priorities.map((q) => ({
        id: q.id,
        title: q.title,
        rank: q.rank,
      }))}
      canEdit={hasPermission(session.user.role, "objective.manage")}
    />
  );
}
