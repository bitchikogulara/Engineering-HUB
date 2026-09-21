"use client";

import type { BoardConfigDto, BoardFilters } from "./types";

const selectCls =
  "rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring";

export function FilterBar({
  config,
  filters,
  onChange,
}: {
  config: BoardConfigDto;
  filters: BoardFilters;
  onChange: (f: BoardFilters) => void;
}) {
  const active =
    filters.assignee ||
    filters.project ||
    filters.type ||
    filters.priority ||
    filters.overdue;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        aria-label="Filter by assignee"
        className={selectCls}
        value={filters.assignee ?? ""}
        onChange={(e) =>
          onChange({ ...filters, assignee: e.target.value || undefined })
        }
      >
        <option value="">Assignee</option>
        {config.members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by project"
        className={selectCls}
        value={filters.project ?? ""}
        onChange={(e) =>
          onChange({ ...filters, project: e.target.value || undefined })
        }
      >
        <option value="">Project</option>
        {config.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by type"
        className={selectCls}
        value={filters.type ?? ""}
        onChange={(e) =>
          onChange({ ...filters, type: e.target.value || undefined })
        }
      >
        <option value="">Type</option>
        {config.types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by priority"
        className={selectCls}
        value={filters.priority ?? ""}
        onChange={(e) =>
          onChange({ ...filters, priority: e.target.value || undefined })
        }
      >
        <option value="">Priority</option>
        <option value="p1">P1</option>
        <option value="p2">P2</option>
        <option value="p3">P3</option>
      </select>
      <label className="flex items-center gap-1 text-muted-foreground text-xs">
        <input
          type="checkbox"
          checked={Boolean(filters.overdue)}
          onChange={(e) =>
            onChange({ ...filters, overdue: e.target.checked || undefined })
          }
        />
        Overdue
      </label>
      {active && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-muted-foreground text-xs underline hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
