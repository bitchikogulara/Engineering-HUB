"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { columnTokenMap } from "./board-colors";
import { TaskCard } from "./task-card";
import type { BoardConfigDto, BoardTaskDto, ColumnDto } from "./types";

export function BoardCanvas({
  config,
  tasks,
  canEdit,
  onMove,
  onOpen,
}: {
  config: BoardConfigDto;
  tasks: BoardTaskDto[];
  canEdit: boolean;
  onMove: (
    taskId: string,
    toColumnId: string,
    beforeTaskId: string | null,
  ) => void;
  onOpen: (task: BoardTaskDto) => void;
}) {
  const [activeTask, setActiveTask] = useState<BoardTaskDto | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );
  const tokenMap = useMemo(
    () => columnTokenMap(config.columns),
    [config.columns],
  );

  const byColumn = useMemo(() => {
    const map = new Map<string, BoardTaskDto[]>();
    for (const col of config.columns) map.set(col.id, []);
    for (const t of tasks) map.get(t.columnId)?.push(t);
    for (const list of map.values())
      list.sort((a, b) => a.position - b.position);
    return map;
  }, [config.columns, tasks]);

  function handleDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === e.active.id) ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over || !canEdit) return;
    const overId = String(over.id);
    if (overId.startsWith("col:")) {
      onMove(String(active.id), overId.slice(4), null);
    } else if (overId !== String(active.id)) {
      const target = tasks.find((t) => t.id === overId);
      if (target) onMove(String(active.id), target.columnId, target.id);
    }
  }

  return (
    <DndContext
      id="board-dnd"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-3">
        {config.columns
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((col) => (
            <BoardColumn
              key={col.id}
              column={col}
              token={tokenMap[col.id]}
              tasks={byColumn.get(col.id) ?? []}
              canEdit={canEdit}
              onOpen={onOpen}
            />
          ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="rotate-2 opacity-90">
            <TaskCard task={activeTask} onOpen={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  column,
  token,
  tasks,
  canEdit,
  onOpen,
}: {
  column: ColumnDto;
  token: string;
  tasks: BoardTaskDto[];
  canEdit: boolean;
  onOpen: (task: BoardTaskDto) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.id}` });

  // Soft WIP hint (spec §5): warn when one person exceeds the column hint.
  const wipWarning = useMemo(() => {
    if (!column.wipHint) return null;
    const counts = new Map<string, { name: string; n: number }>();
    for (const t of tasks) {
      const e = counts.get(t.assigneeId) ?? { name: t.assigneeName, n: 0 };
      e.n += 1;
      counts.set(t.assigneeId, e);
    }
    const over = [...counts.values()].filter(
      (e) => e.n > (column.wipHint ?? 0),
    );
    return over.length
      ? `${over.map((e) => e.name.split(" ")[0]).join(", ")} over WIP ${column.wipHint}`
      : null;
  }, [tasks, column.wipHint]);

  return (
    <section
      ref={setNodeRef}
      className={`flex w-[86vw] shrink-0 flex-col rounded-lg border bg-surface-2 sm:w-72 ${
        isOver ? "border-(--ring)" : "border-border"
      } ${column.isBlocked ? "border-(--col-blocked)/40" : ""}`}
    >
      <header
        className={`flex items-center gap-2 rounded-t-lg px-3 py-2 ${
          column.isBlocked
            ? "bg-(--col-blocked-bg) text-(--col-blocked-fg)"
            : ""
        }`}
      >
        <span
          className="size-2 rounded-full"
          style={{ background: `var(--col-${token})` }}
          aria-hidden
        />
        <h2 className="font-medium text-sm">{column.name}</h2>
        <span className="font-mono text-muted-foreground text-xs">
          {tasks.length}
        </span>
        {wipWarning && (
          <span
            className="ml-auto truncate text-(--badge-stale-fg) text-xs"
            title={wipWarning}
          >
            ⚠ {wipWarning}
          </span>
        )}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {tasks.length === 0 && (
          <p className="py-6 text-center text-muted-foreground text-xs">
            Nothing here
          </p>
        )}
        {tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            disabled={!canEdit}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}

function DraggableCard({
  task,
  disabled,
  onOpen,
}: {
  task: BoardTaskDto;
  disabled: boolean;
  onOpen: (task: BoardTaskDto) => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: task.id,
    disabled,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: task.id });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        setDropRef(node);
      }}
      {...attributes}
      {...listeners}
      className={`select-none touch-none ${isDragging ? "opacity-40" : ""} ${
        isOver ? "translate-y-0.5 border-t-2 border-t-(--ring)" : ""
      }`}
    >
      <TaskCard task={task} onOpen={onOpen} />
    </div>
  );
}
