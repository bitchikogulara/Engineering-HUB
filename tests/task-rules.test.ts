import { describe, expect, it } from "vitest";
import {
  assertBlockedMove,
  assertExternalRequester,
  exceedsWipHint,
  isArchived,
  isOverdue,
  isStale,
  positionBetween,
  TaskRuleError,
} from "@/lib/task-rules";

const DAY = 86_400_000;
const now = new Date("2026-09-21T12:00:00Z");

describe("FR-4 blocked-reason rule", () => {
  it("rejects a move to a blocked column without a reason", () => {
    expect(() => assertBlockedMove({ isBlocked: true }, "")).toThrow(
      TaskRuleError,
    );
    expect(() => assertBlockedMove({ isBlocked: true }, "   ")).toThrow(
      TaskRuleError,
    );
    expect(() => assertBlockedMove({ isBlocked: true }, null)).toThrow(
      TaskRuleError,
    );
  });
  it("allows a move to a blocked column with a reason", () => {
    expect(() =>
      assertBlockedMove({ isBlocked: true }, "waiting on transceiver"),
    ).not.toThrow();
  });
  it("never requires a reason for non-blocked columns", () => {
    expect(() => assertBlockedMove({ isBlocked: false }, null)).not.toThrow();
  });
});

describe("FR-44 external requester rule", () => {
  it("requires requester name and department for external types", () => {
    expect(() =>
      assertExternalRequester({ isExternal: true }, null, null),
    ).toThrow(TaskRuleError);
    expect(() =>
      assertExternalRequester({ isExternal: true }, "G. Beridze", ""),
    ).toThrow(TaskRuleError);
  });
  it("passes with both fields, and ignores internal types", () => {
    expect(() =>
      assertExternalRequester({ isExternal: true }, "G. Beridze", "Service"),
    ).not.toThrow();
    expect(() =>
      assertExternalRequester({ isExternal: false }, null, null),
    ).not.toThrow();
  });
});

describe("FR-5 auto-archive after 14 days", () => {
  it("archives done cards older than 14 days", () => {
    expect(
      isArchived({ doneAt: new Date(now.getTime() - 15 * DAY) }, now),
    ).toBe(true);
  });
  it("keeps recent done cards and open cards", () => {
    expect(
      isArchived({ doneAt: new Date(now.getTime() - 13 * DAY) }, now),
    ).toBe(false);
    expect(isArchived({ doneAt: null }, now)).toBe(false);
  });
});

describe("FR-6 stale after 7 days", () => {
  it("flags cards untouched for more than 7 days", () => {
    expect(
      isStale(
        { lastActivityAt: new Date(now.getTime() - 8 * DAY), doneAt: null },
        now,
      ),
    ).toBe(true);
  });
  it("does not flag active or done cards", () => {
    expect(
      isStale(
        { lastActivityAt: new Date(now.getTime() - 6 * DAY), doneAt: null },
        now,
      ),
    ).toBe(false);
    expect(
      isStale(
        { lastActivityAt: new Date(now.getTime() - 30 * DAY), doneAt: now },
        now,
      ),
    ).toBe(false);
  });
});

describe("overdue badge", () => {
  it("is overdue the day after the due date, never when done", () => {
    expect(isOverdue({ dueDate: "2026-09-20", doneAt: null }, now)).toBe(true);
    expect(isOverdue({ dueDate: "2026-09-21", doneAt: null }, now)).toBe(false);
    expect(isOverdue({ dueDate: "2026-09-20", doneAt: now }, now)).toBe(false);
    expect(isOverdue({ dueDate: null, doneAt: null }, now)).toBe(false);
  });
});

describe("drag ordering", () => {
  it("computes positions between neighbors", () => {
    expect(positionBetween(null, null)).toBe(1000);
    expect(positionBetween(1000, null)).toBe(2000);
    expect(positionBetween(null, 1000)).toBe(0);
    expect(positionBetween(1000, 2000)).toBe(1500);
  });
});

describe("WIP hint", () => {
  it("warns only above the hint, and never when the hint is off", () => {
    expect(exceedsWipHint(4, 3)).toBe(true);
    expect(exceedsWipHint(3, 3)).toBe(false);
    expect(exceedsWipHint(99, null)).toBe(false);
  });
});
