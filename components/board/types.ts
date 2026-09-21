// Serialized shapes passed from server components to the board UI.

export type BoardTaskDto = {
  id: string;
  displayNumber: number;
  title: string;
  description: string | null;
  columnId: string;
  position: number;
  assigneeId: string;
  assigneeName: string;
  projectId: string | null;
  projectName: string | null;
  projectColor: number | null;
  typeId: string;
  typeName: string;
  typeColor: string;
  typeIsExternal: boolean;
  requesterName: string | null;
  requesterDepartment: string | null;
  priority: string;
  estimate: string | null;
  dueDate: string | null;
  blockedReason: string | null;
  labels: string[];
  createdByType: string;
  stale: boolean;
  overdue: boolean;
};

export type ColumnDto = {
  id: string;
  name: string;
  position: number;
  wipHint: number | null;
  isBlocked: boolean;
  isDone: boolean;
};

export type MemberDto = { id: string; name: string; role: string };
export type ProjectDto = { id: string; name: string; color: number };
export type TaskTypeDto = {
  id: string;
  name: string;
  color: string;
  icon: string;
  isExternal: boolean;
};

export type BoardConfigDto = {
  columns: ColumnDto[];
  projects: ProjectDto[];
  types: TaskTypeDto[];
  members: MemberDto[];
};

export type BoardFilters = {
  assignee?: string;
  project?: string;
  type?: string;
  priority?: string;
  overdue?: boolean;
};

export function applyFilters(
  tasks: BoardTaskDto[],
  f: BoardFilters,
): BoardTaskDto[] {
  return tasks.filter(
    (t) =>
      (!f.assignee || t.assigneeId === f.assignee) &&
      (!f.project || t.projectId === f.project) &&
      (!f.type || t.typeId === f.type) &&
      (!f.priority || t.priority === f.priority) &&
      (!f.overdue || t.overdue),
  );
}
