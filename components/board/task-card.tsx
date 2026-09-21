"use client";

import { initials } from "./board-colors";
import type { BoardTaskDto } from "./types";

// Card visual per design/01-board.html: type chip + EH-number on top,
// title, badge row, meta row. Blocked cards carry a red left border and
// the reason; color is never the only signal (labels + icons everywhere).

export function TaskCard({
  task,
  onOpen,
}: {
  task: BoardTaskDto;
  onOpen: (task: BoardTaskDto) => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a <button> can't wrap the drag handles cleanly
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      className={`cursor-pointer rounded-md border border-border bg-card p-2.5 shadow-xs transition-shadow hover:shadow-sm ${
        task.blockedReason ? "border-l-2 border-l-(--col-blocked)" : ""
      }`}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px]"
          style={{
            background: `var(--type-${task.typeColor}-bg)`,
            color: `var(--type-${task.typeColor}-fg)`,
          }}
        >
          {task.typeIsExternal && <span aria-hidden>↘</span>}
          {task.typeName}
        </span>
        {task.createdByType === "ai" && (
          <span
            className="rounded-full bg-(--ai-origin-bg) px-1.5 py-0.5 text-[11px] text-(--ai-origin-fg)"
            title="Created from a meeting by AI, confirmed by a human"
          >
            ✦ AI
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          EH-{task.displayNumber}
        </span>
      </div>

      <p className="mb-1.5 font-medium text-card-foreground text-sm leading-snug">
        {task.title}
      </p>

      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        <span
          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px]"
          style={{
            background: `var(--priority-${task.priority}-bg)`,
            color: `var(--priority-${task.priority}-fg)`,
          }}
        >
          ⚑ {task.priority.toUpperCase()}
        </span>
        {task.overdue && (
          <span className="rounded bg-(--badge-overdue-bg) px-1.5 py-0.5 text-[11px] text-(--badge-overdue-fg)">
            ⏰ Overdue
          </span>
        )}
        {task.stale && (
          <span className="rounded bg-(--badge-stale-bg) px-1.5 py-0.5 text-[11px] text-(--badge-stale-fg)">
            ◷ Stale
          </span>
        )}
        {task.estimate && (
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-secondary-foreground uppercase">
            {task.estimate}
          </span>
        )}
      </div>

      {task.blockedReason && (
        <p className="mb-1.5 rounded bg-(--col-blocked-bg) px-2 py-1 text-(--col-blocked-fg) text-[11px]">
          ⚠ {task.blockedReason}
        </p>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {task.projectName && (
          <span className="inline-flex items-center gap-1 truncate">
            <span
              className="size-1.5 rounded-full"
              style={{ background: `var(--project-${task.projectColor})` }}
              aria-hidden
            />
            {task.projectName}
          </span>
        )}
        {task.typeIsExternal && task.requesterName && (
          <span className="truncate">· req. {task.requesterName}</span>
        )}
        <span
          className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-[10px] text-secondary-foreground"
          title={task.assigneeName}
        >
          {initials(task.assigneeName)}
        </span>
      </div>
    </div>
  );
}
