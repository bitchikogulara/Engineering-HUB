"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createObjective,
  deleteObjective,
  updateObjective,
} from "@/lib/actions/objectives";
import {
  createQuarterlyPriority,
  deleteQuarterlyPriority,
} from "@/lib/actions/quarterly";

const inputCls =
  "rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

const STATES = ["planned", "active", "achieved", "missed", "rolled"] as const;
const STATE_LABEL: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  achieved: "Achieved",
  missed: "Missed",
  rolled: "Rolled over",
};

type ObjectiveDto = {
  id: string;
  title: string;
  weekStart: string;
  state: string;
  ownerId: string;
  ownerName: string;
  quarterlyPriorityId: string | null;
  done: number;
  total: number;
};

type PriorityDto = { id: string; title: string; rank: number };

function mondayOfThisWeek(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function ObjectivesScreen({
  objectives,
  members,
  quarter,
  priorities,
  canEdit,
}: {
  objectives: ObjectiveDto[];
  members: { id: string; name: string }[];
  quarter: string;
  priorities: PriorityDto[];
  canEdit: boolean;
}) {
  const [newPriority, setNewPriority] = useState("");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [weekStart, setWeekStart] = useState(mondayOfThisWeek());
  const [ownerId, setOwnerId] = useState(members[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  const byWeek = new Map<string, ObjectiveDto[]>();
  for (const o of objectives) {
    const list = byWeek.get(o.weekStart) ?? [];
    list.push(o);
    byWeek.set(o.weekStart, list);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-semibold text-foreground text-xl">Objectives</h1>
      {error && (
        <p className="rounded-md bg-(--badge-overdue-bg) px-3 py-2 text-(--badge-overdue-fg) text-sm">
          {error}
        </p>
      )}

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          Quarterly priorities · {quarter}
        </h2>
        {priorities.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            None yet — quarterly planning sets them.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {priorities.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-muted-foreground text-xs">
                  #{p.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-card-foreground">
                  {p.title}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete priority "${p.title}"?`))
                        void run(() => deleteQuarterlyPriority({ id: p.id }));
                    }}
                    className="rounded-md border border-border px-2 py-0.5 text-muted-foreground text-xs hover:bg-accent hover:text-destructive"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newPriority.trim()) return;
              void run(() =>
                createQuarterlyPriority({
                  title: newPriority.trim(),
                  quarter,
                  rank: priorities.length + 1,
                }),
              );
              setNewPriority("");
            }}
          >
            <input
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              placeholder="New quarterly priority"
              className={`${inputCls} flex-1`}
            />
            <button
              type="submit"
              className="rounded-md border border-border px-3 text-sm hover:bg-accent"
            >
              Add
            </button>
          </form>
        )}
      </section>

      {canEdit && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            void run(() =>
              createObjective({
                title: title.trim(),
                weekStart,
                ownerId,
                state: "active",
              }),
            );
            setTitle("");
          }}
        >
          <label className="min-w-60 flex-1">
            <span className="mb-1 block text-muted-foreground text-xs">
              New objective (an outcome, not an activity)
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Diagnostic app covers CFMoto models"'
              className={`${inputCls} w-full`}
            />
          </label>
          <label>
            <span className="mb-1 block text-muted-foreground text-xs">
              Week of
            </span>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className={inputCls}
            />
          </label>
          <label>
            <span className="mb-1 block text-muted-foreground text-xs">
              Owner
            </span>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className={inputCls}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-1.5 font-medium text-primary-foreground text-sm hover:opacity-90"
          >
            Add
          </button>
        </form>
      )}

      {[...byWeek.entries()].map(([week, list]) => (
        <section key={week}>
          <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Week of {week}
          </h2>
          <ul className="space-y-2">
            {list.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <span
                  className="rounded px-1.5 py-0.5 text-[11px]"
                  style={{
                    background: `var(--obj-${o.state === "rolled" ? "rolled" : o.state}-bg)`,
                    color: `var(--obj-${o.state === "rolled" ? "rolled" : o.state}-fg)`,
                  }}
                >
                  {STATE_LABEL[o.state]}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                  {o.title}
                </span>
                <span className="text-muted-foreground text-xs">
                  {o.ownerName.split(" ")[0]}
                </span>
                <span className="font-mono text-muted-foreground text-xs">
                  {o.done}/{o.total} done
                </span>
                {canEdit && (
                  <>
                    {priorities.length > 0 && (
                      <select
                        value={o.quarterlyPriorityId ?? ""}
                        onChange={(e) =>
                          void run(() =>
                            updateObjective({
                              id: o.id,
                              quarterlyPriorityId: e.target.value || null,
                            }),
                          )
                        }
                        className={`${inputCls} max-w-36 py-1 text-xs`}
                        aria-label="Quarterly priority"
                      >
                        <option value="">No quarter link</option>
                        {priorities.map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.rank} {p.title}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      value={o.state}
                      onChange={(e) =>
                        void run(() =>
                          updateObjective({ id: o.id, state: e.target.value }),
                        )
                      }
                      className={`${inputCls} py-1 text-xs`}
                      aria-label="Objective state"
                    >
                      {STATES.map((s) => (
                        <option key={s} value={s}>
                          {STATE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete objective "${o.title}"?`))
                          void run(() => deleteObjective({ id: o.id }));
                      }}
                      className="rounded-md border border-border px-2 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-destructive"
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {objectives.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
          No objectives yet. Weekly planning creates them — or add one above.
        </p>
      )}
    </div>
  );
}
