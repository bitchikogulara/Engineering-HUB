import type { ColumnDto } from "./types";

// Maps dynamic board data onto the fixed design-token vocabulary
// (design/tokens.css). Columns are admin-editable, so color follows the
// flags and position, never the name.

const FLOW_KEYS = ["backlog", "thisweek", "inprogress", "review"] as const;

export function columnTokenKey(column: ColumnDto, flowIndex: number): string {
  if (column.isBlocked) return "blocked";
  if (column.isDone) return "done";
  return FLOW_KEYS[flowIndex % FLOW_KEYS.length];
}

/** Assigns each column its token key in board order. */
export function columnTokenMap(columns: ColumnDto[]): Record<string, string> {
  const map: Record<string, string> = {};
  let flow = 0;
  for (const col of [...columns].sort((a, b) => a.position - b.position)) {
    if (col.isBlocked || col.isDone) {
      map[col.id] = columnTokenKey(col, 0);
    } else {
      map[col.id] = columnTokenKey(col, flow);
      flow += 1;
    }
  }
  return map;
}

export const priorityToken: Record<string, string> = {
  p1: "p1",
  p2: "p2",
  p3: "p3",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
