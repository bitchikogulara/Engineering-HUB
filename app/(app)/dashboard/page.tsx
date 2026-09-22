import type { Metadata } from "next";
import Link from "next/link";
import {
  getColumnCounts,
  getDeliveredRecently,
  getDueNext7Days,
  getOverdueTasks,
  getQuarterProgress,
  getRecentDecisions,
  getStaleTasks,
  getUpcomingMeetings,
} from "@/lib/queries/dashboard";
import { getObjectives } from "@/lib/queries/objectives";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function Card({
  title,
  children,
  href,
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center">
        <h2 className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="ml-auto text-muted-foreground text-xs hover:text-foreground"
          >
            →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function TaskList({
  tasks,
  badge,
  badgeToken,
}: {
  tasks: {
    id: string;
    displayNumber: number;
    title: string;
    assigneeName: string;
    dueDate: string | null;
  }[];
  badge?: string;
  badgeToken?: string;
}) {
  if (tasks.length === 0)
    return <p className="text-muted-foreground text-xs">Nothing — good.</p>;
  return (
    <ul className="space-y-1.5">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-2 text-sm">
          <span className="font-mono text-muted-foreground text-xs">
            EH-{t.displayNumber}
          </span>
          <span className="min-w-0 flex-1 truncate text-card-foreground">
            {t.title}
          </span>
          {t.dueDate && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {t.dueDate.slice(5)}
            </span>
          )}
          {badge && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{
                background: `var(--badge-${badgeToken}-bg)`,
                color: `var(--badge-${badgeToken}-fg)`,
              }}
            >
              {badge}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const isViewer = session.user.role === "viewer";

  const [objectives, quarter, delivered, decisions, upcoming] =
    await Promise.all([
      getObjectives({ activeOnly: true }),
      getQuarterProgress(),
      getDeliveredRecently(),
      getRecentDecisions(),
      isViewer ? [] : getUpcomingMeetings(),
    ]);

  const objectivesCard = (
    <Card title="This week's objectives" href="/objectives">
      {objectives.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No active objectives — weekly planning creates them.
        </p>
      ) : (
        <ul className="space-y-2">
          {objectives.map((o) => (
            <li key={o.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-card-foreground text-sm">
                {o.title}
              </span>
              <span className="font-mono text-muted-foreground text-xs">
                {o.done}/{o.total}
              </span>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-(--obj-active)"
                  style={{
                    width: `${o.total ? Math.round((o.done / o.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const quarterCard = (
    <Card title={`Quarter progress · ${quarter.quarter}`}>
      {quarter.priorities.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No quarterly priorities set yet — they come from quarterly planning.
        </p>
      ) : (
        <ul className="space-y-2">
          {quarter.priorities.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground text-xs">
                #{p.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-card-foreground text-sm">
                {p.title}
              </span>
              <span className="font-mono text-muted-foreground text-xs">
                {p.total ? `${Math.round((p.achieved / p.total) * 100)}%` : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const decisionsCard = (
    <Card title="Recent decisions" href="/decisions">
      {decisions.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No decisions logged yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {decisions.map((d) => (
            <li key={d.id} className="text-sm">
              <span className="text-card-foreground">{d.text}</span>
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                {d.date}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const deliveredCard = (
    <Card title="Delivered recently">
      {delivered.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nothing completed yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {delivered.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <span className="text-(--obj-achieved-fg)">✓</span>
              <span className="min-w-0 flex-1 truncate text-card-foreground">
                {t.title}
              </span>
              <span className="text-muted-foreground text-xs">
                {t.assigneeName.split(" ")[0]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  // --- Viewer (boss) dashboard: calm, read-only (FR-28) ---
  if (isViewer) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="font-semibold text-foreground text-xl">
          Engineering — status
        </h1>
        {quarterCard}
        {objectivesCard}
        {deliveredCard}
        {decisionsCard}
      </div>
    );
  }

  // --- Member/admin dashboard (FR-27) ---
  const [columns, overdue, stale, dueSoon] = await Promise.all([
    getColumnCounts(),
    getOverdueTasks(),
    getStaleTasks(),
    getDueNext7Days(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-semibold text-foreground text-xl">
          Welcome, {session.user.name.split(" ")[0]}
        </h1>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Link
            href="/summary"
            className="rounded-full border border-border bg-surface-1 px-2.5 py-1 text-muted-foreground text-xs hover:text-foreground"
          >
            Weekly summary
          </Link>
          {upcoming.slice(0, 2).map((m) => (
            <Link
              key={m.baseId}
              href="/meetings"
              className={`rounded-full border px-2.5 py-1 text-xs ${
                m.overdue
                  ? "border-(--badge-overdue) bg-(--badge-overdue-bg) text-(--badge-overdue-fg)"
                  : "border-border bg-surface-1 text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.overdue
                ? `⚠ ${m.name} overdue`
                : `${m.name} · ${m.nextAt ? new Date(m.nextAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) : ""}`}
            </Link>
          ))}
        </div>
      </div>

      <Card title="Board snapshot" href="/board">
        <div className="flex flex-wrap gap-2">
          {columns.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 ${
                c.isBlocked && c.count > 0
                  ? "border-(--col-blocked) bg-(--col-blocked-bg)"
                  : "border-border bg-surface-2"
              }`}
            >
              <span
                className={`text-xs ${
                  c.isBlocked && c.count > 0
                    ? "text-(--col-blocked-fg)"
                    : "text-muted-foreground"
                }`}
              >
                {c.name}
              </span>
              <span
                className={`font-mono text-sm ${
                  c.isBlocked && c.count > 0
                    ? "font-semibold text-(--col-blocked-fg)"
                    : "text-foreground"
                }`}
              >
                {c.count}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {objectivesCard}
        {quarterCard}
        <Card title="Overdue" href="/board?overdue=1">
          <TaskList tasks={overdue} badge="overdue" badgeToken="overdue" />
        </Card>
        <Card title="Stale (7+ days untouched)">
          <TaskList tasks={stale} badge="stale" badgeToken="stale" />
        </Card>
        <Card title="Due in the next 7 days">
          <TaskList tasks={dueSoon} />
        </Card>
        {decisionsCard}
      </div>
    </div>
  );
}
