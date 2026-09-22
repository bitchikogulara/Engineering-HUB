import { describe, expect, it } from "vitest";
import {
  isOccurrenceOverdue,
  nextOccurrence,
  occurrenceToday,
  quarterOf,
  tzInstant,
  weekStartOf,
} from "@/lib/schedule";

// Tbilisi is UTC+4. 2026-09-22 is a Tuesday.
const tueMorning = new Date("2026-09-22T04:00:00Z"); // 08:00 local
const tueEvening = new Date("2026-09-22T14:00:00Z"); // 18:00 local

const daily = {
  scheduleDow: [1, 2, 3, 4, 5],
  scheduleTime: "09:30",
  monthlyLast: false,
  scheduleEnabled: true,
};
const mondayPlanning = { ...daily, scheduleDow: [1], scheduleTime: "10:00" };
const lastFridayRetro = {
  scheduleDow: [5],
  scheduleTime: "15:00",
  monthlyLast: true,
  scheduleEnabled: true,
};

describe("nextOccurrence (FR-40)", () => {
  it("finds today's daily sync before it happens", () => {
    expect(nextOccurrence(daily, tueMorning)?.toISOString()).toBe(
      tzInstant(2026, 9, 22, "09:30").toISOString(),
    );
  });
  it("rolls to the next weekday after today's slot passed", () => {
    expect(nextOccurrence(daily, tueEvening)?.toISOString()).toBe(
      tzInstant(2026, 9, 23, "09:30").toISOString(),
    );
  });
  it("skips the weekend", () => {
    const friEvening = new Date("2026-09-25T14:00:00Z");
    expect(nextOccurrence(daily, friEvening)?.toISOString()).toBe(
      tzInstant(2026, 9, 28, "09:30").toISOString(),
    );
  });
  it("finds next Monday planning", () => {
    expect(nextOccurrence(mondayPlanning, tueMorning)?.toISOString()).toBe(
      tzInstant(2026, 9, 28, "10:00").toISOString(),
    );
  });
  it("finds the LAST Friday of the month for the retro", () => {
    // September 2026: Fridays are 4, 11, 18, 25 → last is the 25th
    expect(nextOccurrence(lastFridayRetro, tueMorning)?.toISOString()).toBe(
      tzInstant(2026, 9, 25, "15:00").toISOString(),
    );
  });
  it("returns null for unscheduled templates", () => {
    expect(
      nextOccurrence(
        {
          scheduleDow: [],
          scheduleTime: null,
          monthlyLast: false,
          scheduleEnabled: false,
        },
        tueMorning,
      ),
    ).toBeNull();
  });
});

describe("occurrenceToday + overdue", () => {
  it("returns today's slot even after it passed", () => {
    expect(occurrenceToday(daily, tueEvening)?.toISOString()).toBe(
      tzInstant(2026, 9, 22, "09:30").toISOString(),
    );
  });
  it("returns null on a non-scheduled day", () => {
    const saturday = new Date("2026-09-26T08:00:00Z");
    expect(occurrenceToday(daily, saturday)).toBeNull();
  });
  it("flags overdue only after 2h and only when not started", () => {
    const occurs = tzInstant(2026, 9, 22, "09:30");
    const at11 = new Date("2026-09-22T07:00:00Z"); // 11:00 local — 1.5h after
    const at12 = new Date("2026-09-22T08:00:00Z"); // 12:00 local — 2.5h after
    expect(isOccurrenceOverdue(occurs, at11, false)).toBe(false);
    expect(isOccurrenceOverdue(occurs, at12, false)).toBe(true);
    expect(isOccurrenceOverdue(occurs, at12, true)).toBe(false);
  });
});

describe("week/quarter helpers", () => {
  it("computes Monday of the week and the quarter label", () => {
    expect(weekStartOf(tueMorning)).toBe("2026-09-21");
    expect(quarterOf(tueMorning)).toBe("2026-Q3");
    expect(quarterOf(new Date("2026-10-02T10:00:00Z"))).toBe("2026-Q4");
  });
});
