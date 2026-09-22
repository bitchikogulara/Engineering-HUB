import type { Metadata } from "next";
import Link from "next/link";
import {
  getAiStats,
  getBlockedStats,
  getCompletions,
  getExternalByDepartment,
  getObjectiveHitRate,
  getThroughputByWeek,
  type Range,
  rangeStart,
} from "@/lib/queries/analytics";
import { requireSession } from "@/lib/session";
import { ThroughputChart } from "./throughput-chart";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

function BarList({ items }: { items: { name: string; n: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  if (items.length === 0)
    return <p className="text-muted-foreground text-xs">No data in range.</p>;
  return (
    <ul className="space-y-1.5">
      {items.slice(0, 8).map((i) => (
        <li key={i.name} className="flex items-center gap-2">
          <span className="w-32 truncate text-muted-foreground text-xs">
            {i.name}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-(--obj-active)"
              style={{ width: `${(i.n / max) * 100}%` }}
            />
          </div>
          <span className="w-6 text-right font-mono text-foreground text-xs">
            {i.n}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatCard({
  headline,
  label,
  sub,
}: {
  headline: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="font-mono font-semibold text-2xl text-foreground">
        {headline}
      </p>
      <p className="text-muted-foreground text-xs">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireSession();
  const params = await searchParams;
  const range: Range = ["week", "month", "quarter"].includes(params.range ?? "")
    ? (params.range as Range)
    : "month";
  const start = rangeStart(range);

  const [throughput, completions, external, blocked, objectives, ai] =
    await Promise.all([
      getThroughputByWeek(),
      getCompletions(start),
      getExternalByDepartment(start),
      getBlockedStats(start),
      getObjectiveHitRate(start),
      getAiStats(start),
    ]);

  const totalDone = completions.byAssignee.reduce((s, x) => s + x.n, 0) || 0;
  const externalTotal = external.reduce((s, x) => s + x.n, 0);
  const hitDenominator = objectives.achieved + objectives.missed;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-semibold text-foreground text-xl">Analytics</h1>
        <div className="ml-auto flex rounded-md border border-border bg-surface-1 p-0.5">
          {(["week", "month", "quarter"] as const).map((r) => (
            <Link
              key={r}
              href={`/analytics?range=${r}`}
              className={`rounded px-3 py-1 text-sm capitalize ${
                range === r
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          headline={String(totalDone)}
          label={`tasks completed this ${range}`}
        />
        <StatCard
          headline={String(externalTotal)}
          label="external requests received"
          sub="the evidence base for the hiring case"
        />
        <StatCard
          headline={`${blocked.blockedDays}d`}
          label="time spent blocked"
          sub={`${blocked.blockedEvents} blocking event(s)`}
        />
        <StatCard
          headline={ai.acceptanceRate === null ? "—" : `${ai.acceptanceRate}%`}
          label="AI proposals accepted"
          sub={`target ≥80% · $${ai.costUsd} spent · ${ai.calls} calls`}
        />
      </div>

      <Panel title="Throughput — tasks completed per week">
        <ThroughputChart data={throughput} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Completed by project">
          <BarList items={completions.byProject} />
        </Panel>
        <Panel title="Completed by task type">
          <BarList items={completions.byType} />
        </Panel>
        <Panel title="Completed by person">
          <BarList items={completions.byAssignee} />
        </Panel>
        <Panel title="External requests by department">
          <BarList items={external} />
        </Panel>
      </div>

      <Panel title="Objectives">
        <div className="flex flex-wrap gap-6">
          <StatCard
            headline={
              hitDenominator > 0
                ? `${Math.round((objectives.achieved / hitDenominator) * 100)}%`
                : "—"
            }
            label="hit rate (achieved vs missed)"
          />
          <div className="flex items-center gap-4 text-sm">
            <span className="text-(--obj-achieved-fg)">
              ● {objectives.achieved} achieved
            </span>
            <span className="text-(--obj-missed-fg)">
              ● {objectives.missed} missed
            </span>
            <span className="text-(--obj-rolled-fg)">
              ● {objectives.rolled} rolled over
            </span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
