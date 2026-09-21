"use client";

import { useMemo, useState } from "react";
import { initials } from "./board-colors";
import type { BoardTaskDto, ColumnDto } from "./types";

type SortKey =
  | "displayNumber"
  | "title"
  | "priority"
  | "dueDate"
  | "assigneeName";

export function ListView({
  tasks,
  columns,
  onOpen,
}: {
  tasks: BoardTaskDto[];
  columns: ColumnDto[];
  onOpen: (task: BoardTaskDto) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("displayNumber");
  const [asc, setAsc] = useState(false);

  const columnName = useMemo(
    () => new Map(columns.map((c) => [c.id, c.name])),
    [columns],
  );

  const sorted = useMemo(() => {
    const list = [...tasks];
    list.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return asc ? cmp : -cmp;
    });
    return list;
  }, [tasks, sortKey, asc]);

  function header(key: SortKey, label: string) {
    return (
      <th className="px-3 py-2 text-left">
        <button
          type="button"
          onClick={() => {
            if (sortKey === key) setAsc(!asc);
            else {
              setSortKey(key);
              setAsc(true);
            }
          }}
          className="font-medium text-muted-foreground text-xs hover:text-foreground"
        >
          {label}
          {sortKey === key ? (asc ? " ↑" : " ↓") : ""}
        </button>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-border border-b bg-surface-2">
          <tr>
            {header("displayNumber", "#")}
            {header("title", "Title")}
            <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">
              Column
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">
              Type
            </th>
            {header("priority", "Priority")}
            {header("dueDate", "Due")}
            {header("assigneeName", "Assignee")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr
              key={t.id}
              onClick={() => onOpen(t)}
              className="cursor-pointer border-border border-b last:border-0 hover:bg-accent/50"
            >
              <td className="px-3 py-2 font-mono text-muted-foreground text-xs">
                EH-{t.displayNumber}
              </td>
              <td className="px-3 py-2 text-card-foreground">
                {t.title}
                {t.stale && (
                  <span className="ml-1.5 rounded bg-(--badge-stale-bg) px-1 text-[10px] text-(--badge-stale-fg)">
                    stale
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground text-xs">
                {columnName.get(t.columnId)}
              </td>
              <td className="px-3 py-2">
                <span
                  className="rounded-full px-1.5 py-0.5 text-[11px]"
                  style={{
                    background: `var(--type-${t.typeColor}-bg)`,
                    color: `var(--type-${t.typeColor}-fg)`,
                  }}
                >
                  {t.typeName}
                </span>
              </td>
              <td className="px-3 py-2">
                <span
                  className="rounded px-1.5 py-0.5 text-[11px]"
                  style={{
                    background: `var(--priority-${t.priority}-bg)`,
                    color: `var(--priority-${t.priority}-fg)`,
                  }}
                >
                  {t.priority.toUpperCase()}
                </span>
              </td>
              <td
                className={`px-3 py-2 font-mono text-xs ${
                  t.overdue
                    ? "text-(--badge-overdue-fg)"
                    : "text-muted-foreground"
                }`}
              >
                {t.dueDate ?? "—"}
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                  <span className="flex size-5 items-center justify-center rounded-full bg-secondary font-medium text-[10px] text-secondary-foreground">
                    {initials(t.assigneeName)}
                  </span>
                  {t.assigneeName.split(" ")[0]}
                </span>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="px-3 py-8 text-center text-muted-foreground text-sm"
              >
                No tasks match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
