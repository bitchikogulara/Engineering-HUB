import type { Metadata } from "next";
import { hasPermission } from "@/lib/permissions";
import { getBoardConfig } from "@/lib/queries/board";
import { getObjectives } from "@/lib/queries/objectives";
import { requireSession } from "@/lib/session";
import { ObjectivesScreen } from "./objectives-screen";

export const metadata: Metadata = { title: "Objectives" };
export const dynamic = "force-dynamic";

export default async function ObjectivesPage() {
  const session = await requireSession();
  const [objectives, config] = await Promise.all([
    getObjectives(),
    getBoardConfig(),
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
        done: o.done,
        total: o.total,
      }))}
      members={config.members}
      canEdit={hasPermission(session.user.role, "objective.manage")}
    />
  );
}
