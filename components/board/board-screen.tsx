"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { moveTask } from "@/lib/actions/tasks";
import { positionBetween } from "@/lib/task-rules";
import { BlockedReasonDialog } from "./blocked-reason-dialog";
import { BoardCanvas } from "./board-canvas";
import { FilterBar } from "./filter-bar";
import { ListView } from "./list-view";
import { TaskSheet } from "./task-sheet";
import {
  applyFilters,
  type BoardConfigDto,
  type BoardFilters,
  type BoardTaskDto,
} from "./types";

type View = "board" | "list" | "mine";

type PendingMove = {
  taskId: string;
  toColumnId: string;
  position: number;
};

type ActiveObjective = {
  id: string;
  title: string;
  done: number;
  total: number;
};

export function BoardScreen({
  config,
  tasks: serverTasks,
  currentUserId,
  canEdit,
  canDelete,
  activeObjectives,
  initialFilters,
  initialView,
}: {
  config: BoardConfigDto;
  tasks: BoardTaskDto[];
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
  activeObjectives: ActiveObjective[];
  initialFilters: BoardFilters;
  initialView: View;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tasks, setTasks] = useState(serverTasks);
  const [filters, setFilters] = useState<BoardFilters>(initialFilters);
  const [view, setView] = useState<View>(initialView);
  const [sheet, setSheet] = useState<
    { mode: "create" } | { mode: "edit"; task: BoardTaskDto } | null
  >(null);
  const [pendingBlocked, setPendingBlocked] = useState<PendingMove | null>(
    null,
  );

  // Server refresh (revalidatePath after any action) re-syncs local state.
  useEffect(() => setTasks(serverTasks), [serverTasks]);

  // Filters + view live in the URL so views can be bookmarked (FR-10).
  const syncUrl = useCallback(
    (f: BoardFilters, v: View) => {
      const p = new URLSearchParams();
      if (f.assignee) p.set("assignee", f.assignee);
      if (f.project) p.set("project", f.project);
      if (f.type) p.set("type", f.type);
      if (f.priority) p.set("priority", f.priority);
      if (f.overdue) p.set("overdue", "1");
      if (v !== "board") p.set("view", v);
      router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
    },
    [router, pathname],
  );

  const setFiltersAndSync = useCallback(
    (f: BoardFilters) => {
      setFilters(f);
      syncUrl(f, view);
    },
    [syncUrl, view],
  );

  const setViewAndSync = useCallback(
    (v: View) => {
      setView(v);
      syncUrl(filters, v);
    },
    [syncUrl, filters],
  );

  const visibleTasks = useMemo(() => {
    const f =
      view === "mine" ? { ...filters, assignee: currentUserId } : filters;
    return applyFilters(tasks, f);
  }, [tasks, filters, view, currentUserId]);

  const applyMove = useCallback(
    async (move: PendingMove, blockedReason?: string) => {
      const target = config.columns.find((c) => c.id === move.toColumnId);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === move.taskId
            ? {
                ...t,
                columnId: move.toColumnId,
                position: move.position,
                blockedReason: target?.isBlocked
                  ? (blockedReason ?? t.blockedReason)
                  : null,
              }
            : t,
        ),
      );
      try {
        await moveTask({
          id: move.taskId,
          toColumnId: move.toColumnId,
          position: move.position,
          blockedReason: blockedReason ?? null,
        });
        router.refresh();
      } catch {
        setTasks(serverTasks); // revert optimistic state on failure
        router.refresh();
      }
    },
    [config.columns, router, serverTasks],
  );

  const requestMove = useCallback(
    (taskId: string, toColumnId: string, beforeTaskId: string | null) => {
      const columnTasks = tasks
        .filter((t) => t.columnId === toColumnId && t.id !== taskId)
        .sort((a, b) => a.position - b.position);
      let position: number;
      if (beforeTaskId) {
        const idx = columnTasks.findIndex((t) => t.id === beforeTaskId);
        position = positionBetween(
          idx > 0 ? columnTasks[idx - 1].position : null,
          columnTasks[idx]?.position ?? null,
        );
      } else {
        position = positionBetween(columnTasks.at(-1)?.position ?? null, null);
      }
      const move = { taskId, toColumnId, position };
      const target = config.columns.find((c) => c.id === toColumnId);
      const task = tasks.find((t) => t.id === taskId);
      if (target?.isBlocked && !task?.blockedReason) {
        setPendingBlocked(move); // FR-4: ask for the blocker before moving
        return;
      }
      void applyMove(move);
    },
    [tasks, config.columns, applyMove],
  );

  return (
    <div className="flex h-full flex-col gap-3">
      {activeObjectives.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-border bg-surface-1 px-3 py-2">
          <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
            This week · Objectives
          </p>
          {activeObjectives.map((o) => (
            <div key={o.id} className="flex items-center gap-3">
              <span className="rounded bg-(--obj-active-bg) px-1.5 py-0.5 text-(--obj-active-fg) text-[11px]">
                Active
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                {o.title}
              </span>
              <span className="font-mono text-muted-foreground text-xs">
                {o.done}/{o.total}
              </span>
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-3 max-sm:hidden">
                <div
                  className="h-full rounded-full bg-(--obj-active)"
                  style={{
                    width: `${o.total ? Math.round((o.done / o.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border bg-surface-1 p-0.5">
          {(["board", "list", "mine"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewAndSync(v)}
              className={`rounded px-3 py-1 text-sm capitalize ${
                view === v
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "mine" ? "My tasks" : v}
            </button>
          ))}
        </div>
        <FilterBar
          config={config}
          filters={filters}
          onChange={setFiltersAndSync}
        />
        {canEdit && (
          <button
            type="button"
            onClick={() => setSheet({ mode: "create" })}
            className="ml-auto rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm hover:opacity-90"
          >
            + New task
          </button>
        )}
      </div>

      {view === "board" ? (
        <BoardCanvas
          config={config}
          tasks={visibleTasks}
          canEdit={canEdit}
          onMove={requestMove}
          onOpen={(task) => setSheet({ mode: "edit", task })}
        />
      ) : (
        <ListView
          tasks={visibleTasks}
          columns={config.columns}
          onOpen={(task) => setSheet({ mode: "edit", task })}
        />
      )}

      {sheet && (
        <TaskSheet
          key={sheet.mode === "edit" ? sheet.task.id : "create"}
          mode={sheet.mode}
          task={sheet.mode === "edit" ? sheet.task : null}
          config={config}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => {
            setSheet(null);
            router.refresh();
          }}
        />
      )}

      {pendingBlocked && (
        <BlockedReasonDialog
          onCancel={() => setPendingBlocked(null)}
          onConfirm={(reason) => {
            const move = pendingBlocked;
            setPendingBlocked(null);
            void applyMove(move, reason);
          }}
        />
      )}
    </div>
  );
}
