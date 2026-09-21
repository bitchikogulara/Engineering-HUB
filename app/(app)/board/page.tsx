import type { Metadata } from "next";
import { BoardScreen } from "@/components/board/board-screen";
import type { BoardTaskDto } from "@/components/board/types";
import { hasPermission } from "@/lib/permissions";
import { getBoardConfig, getBoardTasks } from "@/lib/queries/board";
import { getObjectives } from "@/lib/queries/objectives";
import { requireSession } from "@/lib/session";
import { isOverdue, isStale } from "@/lib/task-rules";

export const metadata: Metadata = { title: "Board" };
export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const [config, rows, objectives] = await Promise.all([
    getBoardConfig(),
    getBoardTasks(),
    getObjectives(),
  ]);
  const activeObjectives = objectives.filter((o) => o.state === "active");

  const now = new Date();
  const tasks: BoardTaskDto[] = rows.map((t) => ({
    id: t.id,
    displayNumber: t.displayNumber,
    title: t.title,
    description: t.description,
    columnId: t.columnId,
    position: t.position,
    assigneeId: t.assigneeId,
    assigneeName: t.assigneeName,
    projectId: t.projectId,
    projectName: t.projectName,
    projectColor: t.projectColor,
    objectiveId: t.objectiveId,
    objectiveTitle: t.objectiveTitle,
    typeId: t.typeId,
    typeName: t.typeName,
    typeColor: t.typeColor,
    typeIsExternal: t.typeIsExternal,
    requesterName: t.requesterName,
    requesterDepartment: t.requesterDepartment,
    priority: t.priority,
    estimate: t.estimate,
    dueDate: t.dueDate,
    blockedReason: t.blockedReason,
    labels: t.labels,
    createdByType: t.createdByType,
    stale: isStale(t, now),
    overdue: isOverdue(t, now),
  }));

  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v.length > 0 ? v : undefined;

  return (
    <BoardScreen
      activeObjectives={activeObjectives.map((o) => ({
        id: o.id,
        title: o.title,
        done: o.done,
        total: o.total,
      }))}
      config={{
        columns: config.columns,
        objectives: objectives
          .filter((o) => o.state === "active" || o.state === "planned")
          .map((o) => ({ id: o.id, title: o.title })),
        projects: config.projects.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
        })),
        types: config.types.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          icon: t.icon,
          isExternal: t.isExternal,
        })),
        members: config.members,
      }}
      tasks={tasks}
      currentUserId={session.user.id}
      canEdit={hasPermission(session.user.role, "task.edit")}
      canDelete={hasPermission(session.user.role, "task.delete")}
      initialFilters={{
        assignee: str(params.assignee),
        project: str(params.project),
        type: str(params.type),
        priority: str(params.priority),
        overdue: params.overdue === "1",
      }}
      initialView={
        params.view === "list" || params.view === "mine" ? params.view : "board"
      }
    />
  );
}
