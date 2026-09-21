"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createColumn,
  createProject,
  createTaskType,
  deleteColumn,
  renameColumn,
  setProjectActive,
  setTaskTypeActive,
} from "@/lib/actions/board-admin";

const inputCls =
  "rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
const btnCls =
  "rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground";

type Column = {
  id: string;
  name: string;
  isBlocked: boolean;
  isDone: boolean;
  wipHint: number | null;
};
type Project = { id: string; name: string; color: number; active: boolean };
type TaskType = {
  id: string;
  name: string;
  color: string;
  isExternal: boolean;
  active: boolean;
};

export function BoardAdminScreen({
  columns,
  projects,
  types,
}: {
  columns: Column[];
  projects: Project[];
  types: TaskType[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newColumn, setNewColumn] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newProjectColor, setNewProjectColor] = useState(1);
  const [newType, setNewType] = useState("");
  const [newTypeExternal, setNewTypeExternal] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-semibold text-foreground text-xl">Board settings</h1>
      {error && (
        <p className="rounded-md bg-(--badge-overdue-bg) px-3 py-2 text-(--badge-overdue-fg) text-sm">
          {error}
        </p>
      )}

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 font-medium text-card-foreground text-sm">
          Columns
        </h2>
        <ul className="mb-3 space-y-2">
          {columns.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input
                defaultValue={c.name}
                className={`${inputCls} flex-1`}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== c.name)
                    void run(() => renameColumn({ id: c.id, name }));
                }}
              />
              {c.isBlocked && (
                <span className="rounded bg-(--col-blocked-bg) px-1.5 py-0.5 text-(--col-blocked-fg) text-[11px]">
                  blocked column
                </span>
              )}
              {c.isDone && (
                <span className="rounded bg-(--col-done-bg) px-1.5 py-0.5 text-(--col-done-fg) text-[11px]">
                  done column
                </span>
              )}
              {c.wipHint && (
                <span className="font-mono text-muted-foreground text-xs">
                  WIP {c.wipHint}
                </span>
              )}
              {!c.isBlocked && !c.isDone && (
                <button
                  type="button"
                  className={btnCls}
                  onClick={() => void run(() => deleteColumn({ id: c.id }))}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newColumn.trim()) {
              void run(() => createColumn({ name: newColumn.trim() }));
              setNewColumn("");
            }
          }}
        >
          <input
            value={newColumn}
            onChange={(e) => setNewColumn(e.target.value)}
            placeholder="New column name"
            className={`${inputCls} flex-1`}
          />
          <button type="submit" className={btnCls}>
            Add column
          </button>
        </form>
        <p className="mt-2 text-muted-foreground text-xs">
          Rename by editing a name and clicking away. Columns holding tasks
          cannot be deleted.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 font-medium text-card-foreground text-sm">
          Projects
        </h2>
        <ul className="mb-3 space-y-1.5">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 rounded-full"
                style={{ background: `var(--project-${p.color})` }}
                aria-hidden
              />
              <span className="text-card-foreground">{p.name}</span>
              <button
                type="button"
                className={`${btnCls} ml-auto`}
                onClick={() =>
                  void run(() => setProjectActive({ id: p.id, active: false }))
                }
              >
                Archive
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newProject.trim()) {
              void run(() =>
                createProject({
                  name: newProject.trim(),
                  color: newProjectColor,
                }),
              );
              setNewProject("");
            }
          }}
        >
          <input
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            placeholder="New project"
            className={`${inputCls} flex-1`}
          />
          <select
            value={newProjectColor}
            onChange={(e) => setNewProjectColor(Number(e.target.value))}
            className={inputCls}
            aria-label="Project color"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Color {n}
              </option>
            ))}
          </select>
          <button type="submit" className={btnCls}>
            Add project
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 font-medium text-card-foreground text-sm">
          Task types
        </h2>
        <ul className="mb-3 space-y-1.5">
          {types.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <span
                className="rounded-full px-1.5 py-0.5 text-[11px]"
                style={{
                  background: `var(--type-${t.color}-bg)`,
                  color: `var(--type-${t.color}-fg)`,
                }}
              >
                {t.isExternal && "↘ "}
                {t.name}
              </span>
              {t.isExternal && (
                <span className="text-muted-foreground text-xs">
                  external — requires requester
                </span>
              )}
              <button
                type="button"
                className={`${btnCls} ml-auto`}
                onClick={() =>
                  void run(() => setTaskTypeActive({ id: t.id, active: false }))
                }
              >
                Archive
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newType.trim()) {
              void run(() =>
                createTaskType({
                  name: newType.trim(),
                  color: newTypeExternal ? "service" : "internal",
                  icon: "wrench",
                  isExternal: newTypeExternal,
                }),
              );
              setNewType("");
              setNewTypeExternal(false);
            }
          }}
        >
          <input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="New task type"
            className={`${inputCls} flex-1`}
          />
          <label className="flex items-center gap-1 text-muted-foreground text-xs">
            <input
              type="checkbox"
              checked={newTypeExternal}
              onChange={(e) => setNewTypeExternal(e.target.checked)}
            />
            External
          </label>
          <button type="submit" className={btnCls}>
            Add type
          </button>
        </form>
      </section>
    </div>
  );
}
