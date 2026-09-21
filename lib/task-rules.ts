// Pure task-lifecycle rules (FR-4, FR-5, FR-6) — no I/O, fully unit-tested.
// Server Actions and queries call these; nothing else re-implements them.

export const ARCHIVE_AFTER_DAYS = 14;
export const STALE_AFTER_DAYS = 7;

export class TaskRuleError extends Error {
  constructor(
    readonly code: "BLOCKED_REASON_REQUIRED" | "REQUESTER_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "TaskRuleError";
  }
}

/** FR-4: entering a blocked column requires a non-empty reason. */
export function assertBlockedMove(
  toColumn: { isBlocked: boolean },
  blockedReason: string | null | undefined,
): void {
  if (toColumn.isBlocked && !blockedReason?.trim()) {
    throw new TaskRuleError(
      "BLOCKED_REASON_REQUIRED",
      "Moving a task to Blocked requires naming the blocker.",
    );
  }
}

/** FR-44: external task types require requester name + department. */
export function assertExternalRequester(
  type: { isExternal: boolean },
  requesterName: string | null | undefined,
  requesterDepartment: string | null | undefined,
): void {
  if (
    type.isExternal &&
    (!requesterName?.trim() || !requesterDepartment?.trim())
  ) {
    throw new TaskRuleError(
      "REQUESTER_REQUIRED",
      "External tasks must record who requested them and from which department.",
    );
  }
}

/** FR-5: Done cards auto-archive after 14 days (still searchable elsewhere). */
export function isArchived(
  task: { doneAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (!task.doneAt) return false;
  return (
    now.getTime() - task.doneAt.getTime() > ARCHIVE_AFTER_DAYS * 86_400_000
  );
}

/** FR-6: untouched for 7 days → stale badge. Done cards are never stale. */
export function isStale(
  task: { lastActivityAt: Date; doneAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (task.doneAt) return false;
  return (
    now.getTime() - task.lastActivityAt.getTime() >
    STALE_AFTER_DAYS * 86_400_000
  );
}

export function isOverdue(
  task: { dueDate: string | null; doneAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (!task.dueDate || task.doneAt) return false;
  // dueDate is a date-only string; overdue starts the day AFTER the due date
  const due = new Date(`${task.dueDate}T23:59:59.999`);
  return now.getTime() > due.getTime();
}

/** Fractional position between two neighbors (drag-and-drop ordering). */
export function positionBetween(
  before: number | null,
  after: number | null,
): number {
  if (before === null && after === null) return 1000;
  if (before === null) return (after as number) - 1000;
  if (after === null) return before + 1000;
  return (before + after) / 2;
}

/** Soft WIP warning: more than `hint` cards for one person in one column. */
export function exceedsWipHint(
  countInColumnForAssignee: number,
  wipHint: number | null,
): boolean {
  return wipHint !== null && countInColumnForAssignee > wipHint;
}
