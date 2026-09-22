"use client";

import { useEffect, useState } from "react";
import { getTaskDetail } from "@/lib/actions/task-detail";
import {
  addComment,
  createTask,
  deleteTask,
  moveTask,
  updateTask,
} from "@/lib/actions/tasks";
import { initials } from "./board-colors";
import type { BoardConfigDto, BoardTaskDto } from "./types";

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
const labelCls = "mb-1 block text-xs text-muted-foreground";

type Detail = Awaited<ReturnType<typeof getTaskDetail>>;

/** " · Backlog → Blocked" when the diff records a column change, else "". */
function formatColumnDiff(diff: Record<string, unknown> | null): string {
  const col = diff?.column;
  if (
    col &&
    typeof col === "object" &&
    "from" in col &&
    "to" in col &&
    typeof (col as { from: unknown }).from === "string"
  ) {
    const { from, to } = col as { from: string; to: string };
    return ` · ${from} → ${to}`;
  }
  return "";
}

export function TaskSheet({
  mode,
  task,
  config,
  canEdit,
  canDelete = false,
  onClose,
}: {
  mode: "create" | "edit";
  task: BoardTaskDto | null;
  config: BoardConfigDto;
  canEdit: boolean;
  canDelete?: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assigneeId, setAssigneeId] = useState(
    task?.assigneeId ?? config.members[0]?.id ?? "",
  );
  const [projectId, setProjectId] = useState(task?.projectId ?? "");
  const [objectiveId, setObjectiveId] = useState(task?.objectiveId ?? "");
  const [typeId, setTypeId] = useState(
    task?.typeId ?? config.types[0]?.id ?? "",
  );
  const [requesterName, setRequesterName] = useState(task?.requesterName ?? "");
  const [requesterDepartment, setRequesterDepartment] = useState(
    task?.requesterDepartment ?? "",
  );
  const [priority, setPriority] = useState(task?.priority ?? "p2");
  const [estimate, setEstimate] = useState(task?.estimate ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [labels, setLabels] = useState((task?.labels ?? []).join(", "));
  const [columnId, setColumnId] = useState(
    task?.columnId ?? config.columns[0]?.id ?? "",
  );
  const [blockedReason, setBlockedReason] = useState(task?.blockedReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [comment, setComment] = useState("");

  const selectedType = config.types.find((t) => t.id === typeId);
  const selectedColumn = config.columns.find((c) => c.id === columnId);

  useEffect(() => {
    if (mode === "edit" && task) {
      getTaskDetail({ taskId: task.id })
        .then(setDetail)
        .catch(() => setDetail(null));
    }
  }, [mode, task]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const base = {
      title,
      description: description || null,
      assigneeId,
      projectId: projectId || null,
      objectiveId: objectiveId || null,
      typeId,
      requesterName: requesterName || null,
      requesterDepartment: requesterDepartment || null,
      priority,
      estimate: estimate || null,
      dueDate: dueDate || null,
      labels: labels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
    };
    try {
      if (mode === "create") {
        await createTask({ ...base, columnId });
      } else if (task) {
        await updateTask({
          ...base,
          id: task.id,
          blockedReason: blockedReason || null,
        });
        if (columnId !== task.columnId) {
          await moveTask({
            id: task.id,
            toColumnId: columnId,
            position: Date.now(),
            blockedReason: blockedReason || null,
          });
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setPending(false);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !comment.trim()) return;
    await addComment({ taskId: task.id, body: comment.trim() });
    setComment("");
    setDetail(await getTaskDetail({ taskId: task.id }));
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-(--overlay)">
      <button
        type="button"
        aria-label="Close"
        className="flex-1"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-border border-l bg-card shadow-(--shadow-sheet)">
        <header className="sticky top-0 flex items-center gap-2 border-border border-b bg-card px-4 py-3">
          <h2 className="font-medium text-card-foreground text-sm">
            {mode === "create"
              ? "New task"
              : `EH-${task?.displayNumber} · ${task?.title}`}
          </h2>
          {mode === "edit" && task && canDelete && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`Delete EH-${task.displayNumber} permanently?`))
                  return;
                await deleteTask({ id: task.id });
                onClose();
              }}
              className="ml-auto rounded-md border border-border px-2 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-destructive"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`rounded-md border border-border px-2 py-1 text-muted-foreground text-xs hover:bg-accent ${
              mode === "edit" && canDelete ? "" : "ml-auto"
            }`}
          >
            Close
          </button>
        </header>

        {mode === "edit" && task?.originMeetingId && (
          <div className="mx-4 mt-3 rounded-md border border-(--ai-ring)/40 bg-(--ai-origin-bg)/30 p-2.5">
            <p className="text-[11px] text-(--ai-origin-fg)">
              ✦ Created by AI from a meeting, confirmed by a human.{" "}
              <a
                href={`/meetings/${task.originMeetingId}`}
                className="underline"
              >
                Open source meeting
              </a>
            </p>
            {task.sourceQuote && (
              <p className="mt-1 border-(--ai-origin) border-l-2 pl-2 text-muted-foreground text-xs italic">
                "{task.sourceQuote}"
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3 p-4">
          <fieldset disabled={!canEdit} className="space-y-3">
            <label className="block">
              <span className={labelCls}>Title</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='Imperative, e.g. "Finish CAN reader for Kässbohrer unit"'
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>
                Description (markdown, checklists)
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={inputCls}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Assignee</span>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className={inputCls}
                >
                  {config.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Column</span>
                <select
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                  className={inputCls}
                >
                  {config.columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Type</span>
                <select
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                  className={inputCls}
                >
                  {config.types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isExternal ? " (external)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Project</span>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {config.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Objective</span>
                <select
                  value={objectiveId}
                  onChange={(e) => setObjectiveId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {config.objectives.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Priority</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={inputCls}
                >
                  <option value="p1">P1 — urgent</option>
                  <option value="p2">P2 — normal</option>
                  <option value="p3">P3 — someday</option>
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Estimate</span>
                <select
                  value={estimate}
                  onChange={(e) => setEstimate(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  <option value="s">S (&lt;2h)</option>
                  <option value="m">M (half-day)</option>
                  <option value="l">L (1–3 days)</option>
                  <option value="xl">XL (needs splitting)</option>
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Due date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Labels (comma-separated)</span>
                <input
                  value={labels}
                  onChange={(e) => setLabels(e.target.value)}
                  placeholder="hardware, firmware"
                  className={inputCls}
                />
              </label>
            </div>

            {selectedType?.isExternal && (
              <div className="grid grid-cols-2 gap-3 rounded-md border border-(--type-service)/40 bg-(--type-service-bg)/40 p-3">
                <label className="block">
                  <span className={labelCls}>Requested by</span>
                  <input
                    required
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="G. Beridze"
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Department</span>
                  <input
                    required
                    value={requesterDepartment}
                    onChange={(e) => setRequesterDepartment(e.target.value)}
                    placeholder="Service"
                    className={inputCls}
                  />
                </label>
              </div>
            )}

            {selectedColumn?.isBlocked && (
              <label className="block">
                <span className={labelCls}>Blocked reason (required)</span>
                <input
                  required
                  value={blockedReason}
                  onChange={(e) => setBlockedReason(e.target.value)}
                  className={inputCls}
                />
              </label>
            )}

            {error && <p className="text-destructive text-xs">{error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-primary py-2 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
            >
              {pending
                ? "Saving…"
                : mode === "create"
                  ? "Create task"
                  : "Save changes"}
            </button>
          </fieldset>
        </form>

        {mode === "edit" && task && (
          <div className="space-y-4 border-border border-t p-4">
            <section>
              <h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Comments
              </h3>
              <div className="space-y-2">
                {detail?.comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-[10px] text-secondary-foreground">
                      {initials(c.authorName)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">
                        {c.authorName} ·{" "}
                        <span className="font-mono">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </p>
                      <p className="text-card-foreground text-sm">{c.body}</p>
                    </div>
                  </div>
                ))}
                {detail && detail.comments.length === 0 && (
                  <p className="text-muted-foreground text-xs">
                    No comments yet.
                  </p>
                )}
              </div>
              {canEdit && (
                <form onSubmit={handleComment} className="mt-2 flex gap-2">
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Comment — @name to mention"
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-md border border-border px-3 text-sm hover:bg-accent"
                  >
                    Send
                  </button>
                </form>
              )}
            </section>

            <section>
              <h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Activity
              </h3>
              <ul className="space-y-1.5">
                {detail?.activity.map((a) => (
                  <li key={a.id} className="text-muted-foreground text-xs">
                    <span
                      className={
                        a.actorType === "ai" ? "text-(--ai-origin-fg)" : ""
                      }
                    >
                      {a.actorName}
                    </span>{" "}
                    {a.action}
                    {formatColumnDiff(a.diff)} ·{" "}
                    <span className="font-mono">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
