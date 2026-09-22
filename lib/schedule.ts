// Meeting scheduling (FR-40). All times are Asia/Tbilisi wall-clock, stored
// as HH:MM + ISO weekday list on the template. Pure functions, unit-tested.

export const APP_TZ = "Asia/Tbilisi";

export type ScheduleRule = {
  scheduleDow: number[]; // 1=Mon … 7=Sun
  scheduleTime: string | null; // "HH:MM"
  monthlyLast: boolean; // last <dow> of the month (retro)
  scheduleEnabled: boolean;
};

/** Wall-clock parts of an instant in the app timezone. */
export function tzParts(d: Date): {
  y: number;
  m: number;
  day: number;
  dow: number; // 1=Mon … 7=Sun
  minutes: number; // minutes since local midnight
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  const dowMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    day: Number(parts.day),
    dow: dowMap[parts.weekday] ?? 1,
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

/** The UTC instant of local wall time y-m-d hh:mm in the app timezone. */
export function tzInstant(
  y: number,
  m: number,
  day: number,
  hhmm: string,
): Date {
  const [h, min] = hhmm.split(":").map(Number);
  // Tbilisi has no DST since 2005 — fixed UTC+4 keeps this exact and simple.
  return new Date(Date.UTC(y, m - 1, day, h - 4, min));
}

function lastDowOfMonth(y: number, m: number, dow: number): number {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let d = lastDay; d > lastDay - 7; d--) {
    const jsDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
    const iso = jsDow === 0 ? 7 : jsDow;
    if (iso === dow) return d;
  }
  return lastDay;
}

/** Next occurrence at or after `now` (null when unscheduled). */
export function nextOccurrence(rule: ScheduleRule, now: Date): Date | null {
  if (
    !rule.scheduleEnabled ||
    !rule.scheduleTime ||
    rule.scheduleDow.length === 0
  ) {
    return null;
  }
  const [h, min] = rule.scheduleTime.split(":").map(Number);
  const targetMinutes = h * 60 + min;

  // Scan forward day by day (bounded: monthly rules repeat within ~35 days).
  for (let offset = 0; offset < 40; offset++) {
    const probe = new Date(now.getTime() + offset * 86_400_000);
    const p = tzParts(probe);
    if (!rule.scheduleDow.includes(p.dow)) continue;
    if (rule.monthlyLast && p.day !== lastDowOfMonth(p.y, p.m, p.dow)) continue;
    if (offset === 0 && p.minutes > targetMinutes) continue; // already passed today
    return tzInstant(p.y, p.m, p.day, rule.scheduleTime);
  }
  return null;
}

/** Today's occurrence (even if already passed), else null. */
export function occurrenceToday(rule: ScheduleRule, now: Date): Date | null {
  if (
    !rule.scheduleEnabled ||
    !rule.scheduleTime ||
    rule.scheduleDow.length === 0
  ) {
    return null;
  }
  const p = tzParts(now);
  if (!rule.scheduleDow.includes(p.dow)) return null;
  if (rule.monthlyLast && p.day !== lastDowOfMonth(p.y, p.m, p.dow))
    return null;
  return tzInstant(p.y, p.m, p.day, rule.scheduleTime);
}

/** FR-40: a scheduled meeting not started within 2h shows as overdue. */
export function isOccurrenceOverdue(
  occursAt: Date,
  now: Date,
  meetingStartedToday: boolean,
): boolean {
  if (meetingStartedToday) return false;
  return now.getTime() - occursAt.getTime() > 2 * 3_600_000;
}

/** Monday (local) of the week containing `now`, as YYYY-MM-DD. */
export function weekStartOf(now: Date): string {
  const p = tzParts(now);
  const monday = new Date(Date.UTC(p.y, p.m - 1, p.day - (p.dow - 1)));
  return monday.toISOString().slice(0, 10);
}

/** Quarter label of `now`, e.g. "2026-Q4". */
export function quarterOf(now: Date): string {
  const p = tzParts(now);
  return `${p.y}-Q${Math.ceil(p.m / 3)}`;
}
