"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Extraction } from "@/ai/schemas";
import { applyProposal, sendProposalFeedback } from "@/lib/actions/ai";

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring";

type Option = { id: string; name: string };
type Verdict = "accepted" | "rejected" | "undecided";

type TaskNewState = {
  verdict: Verdict;
  title: string;
  assigneeId: string | null;
  projectId: string | null;
  typeId: string;
  objectiveId: string | null;
  columnId: string;
  priority: "p1" | "p2" | "p3";
  requesterName: string | null;
  requesterDepartment: string | null;
};

function confidenceChip(c: string) {
  const color = c === "high" ? "high" : c === "medium" ? "med" : "low";
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[10px]"
      style={{
        border: `1px solid var(--confidence-${color})`,
        color: `var(--confidence-${color})`,
      }}
    >
      {c}
    </span>
  );
}

export function ProposalScreen({
  meetingId,
  templateName,
  sourceText,
  extraction,
  options,
  prefills,
}: {
  meetingId: string;
  templateName: string;
  sourceText: string;
  extraction: Extraction;
  options: {
    members: Option[];
    projects: Option[];
    types: (Option & { isExternal: boolean })[];
    objectives: Option[];
    columns: (Option & { isBlocked: boolean })[];
  };
  prefills: {
    assigneeId: string | null;
    projectId: string | null;
    typeId: string;
    objectiveId: string | null;
    columnId: string;
  }[];
}) {
  const router = useRouter();
  const [tasksNew, setTasksNew] = useState<TaskNewState[]>(() =>
    extraction.tasks_new.map((t, i) => ({
      verdict:
        t.needs_attention || !prefills[i]?.assigneeId
          ? "undecided"
          : "accepted",
      title: t.title,
      assigneeId: prefills[i]?.assigneeId ?? null,
      projectId: prefills[i]?.projectId ?? null,
      typeId: prefills[i]?.typeId ?? options.types[0]?.id ?? "",
      objectiveId: prefills[i]?.objectiveId ?? null,
      columnId: prefills[i]?.columnId ?? options.columns[0]?.id ?? "",
      priority: t.priority,
      requesterName: t.requester_name,
      requesterDepartment: t.requester_department,
    })),
  );
  const simpleInit = (items: { needs_attention: boolean }[]): Verdict[] =>
    items.map((x) => (x.needs_attention ? "undecided" : "accepted"));
  const [updates, setUpdates] = useState<Verdict[]>(() =>
    simpleInit(extraction.tasks_update),
  );
  const [objectives, setObjectives] = useState<Verdict[]>(() =>
    simpleInit(extraction.objectives),
  );
  const [decisions, setDecisions] = useState<Verdict[]>(() =>
    simpleInit(extraction.decisions),
  );
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState<"confirm" | "feedback" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);

  const undecidedCount = useMemo(
    () =>
      tasksNew.filter((t) => t.verdict === "undecided").length +
      [...updates, ...objectives, ...decisions].filter((v) => v === "undecided")
        .length,
    [tasksNew, updates, objectives, decisions],
  );
  const acceptedCount = useMemo(
    () =>
      tasksNew.filter((t) => t.verdict === "accepted").length +
      [...updates, ...objectives, ...decisions].filter((v) => v === "accepted")
        .length,
    [tasksNew, updates, objectives, decisions],
  );

  async function confirm() {
    setPending("confirm");
    setError(null);
    try {
      await applyProposal({
        meetingId,
        tasksNew: tasksNew.map((t, index) => ({
          index,
          accepted: t.verdict === "accepted",
          title: t.title,
          assigneeId: t.assigneeId ?? undefined,
          columnId: t.columnId,
          typeId: t.typeId,
          projectId: t.projectId,
          objectiveId: t.objectiveId,
          priority: t.priority,
          requesterName: t.requesterName,
          requesterDepartment: t.requesterDepartment,
        })),
        tasksUpdate: updates.map((v, index) => ({
          index,
          accepted: v === "accepted",
        })),
        objectives: objectives.map((v, index) => ({
          index,
          accepted: v === "accepted",
        })),
        decisions: decisions.map((v, index) => ({
          index,
          accepted: v === "accepted",
        })),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
      setPending(null);
    }
  }

  async function submitFeedback() {
    if (feedback.trim().length < 3) return;
    setPending("feedback");
    setError(null);
    try {
      await sendProposalFeedback({ meetingId, feedback: feedback.trim() });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feedback failed");
      setPending(null);
    }
  }

  function verdictButtons(verdict: Verdict, set: (v: Verdict) => void) {
    return (
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => set(verdict === "accepted" ? "undecided" : "accepted")}
          className={`rounded-md px-2 py-1 text-xs ${
            verdict === "accepted"
              ? "bg-(--obj-achieved-bg) text-(--obj-achieved-fg)"
              : "border border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          ✓ Accept
        </button>
        <button
          type="button"
          onClick={() => set(verdict === "rejected" ? "undecided" : "rejected")}
          className={`rounded-md px-2 py-1 text-xs ${
            verdict === "rejected"
              ? "bg-(--badge-overdue-bg) text-(--badge-overdue-fg)"
              : "border border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          ✕ Reject
        </button>
      </div>
    );
  }

  const cardCls = (verdict: Verdict, needsAttention: boolean) =>
    `rounded-lg border bg-card p-3 ${
      verdict === "rejected"
        ? "border-border opacity-50"
        : needsAttention && verdict === "undecided"
          ? "border-(--badge-stale)"
          : verdict === "undecided"
            ? "border-(--ai-ring)/50"
            : "border-border"
    }`;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-28">
      <header>
        <h1 className="font-semibold text-foreground text-xl">
          Review proposal · {templateName}
        </h1>
        <p className="text-muted-foreground text-sm">
          The AI extracted these from the meeting.{" "}
          <strong className="text-foreground">
            Nothing is applied until you confirm.
          </strong>
        </p>
        <button
          type="button"
          onClick={() => setShowSource(!showSource)}
          className="mt-2 rounded-md border border-border px-2.5 py-1 text-muted-foreground text-xs hover:bg-accent"
        >
          {showSource ? "Hide" : "Show"} meeting source
        </button>
        {showSource && (
          <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 font-mono text-foreground text-xs">
            {sourceText}
          </pre>
        )}
      </header>

      {m_section(
        `New tasks (${extraction.tasks_new.length})`,
        extraction.tasks_new.length,
      )}
      {extraction.tasks_new.map((t, i) => {
        const state = tasksNew[i];
        const set = (patch: Partial<TaskNewState>) =>
          setTasksNew((prev) =>
            prev.map((s, j) => (j === i ? { ...s, ...patch } : s)),
          );
        const selectedType = options.types.find((x) => x.id === state.typeId);
        const selectedColumn = options.columns.find(
          (x) => x.id === state.columnId,
        );
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: extraction arrays are immutable per proposal
            key={`new-${i}`}
            className={cardCls(state.verdict, t.needs_attention)}
          >
            <div className="mb-1.5 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <input
                  value={state.title}
                  onChange={(e) => set({ title: e.target.value })}
                  className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 font-medium text-card-foreground text-sm hover:border-input focus:border-input focus:outline-none"
                />
              </div>
              {confidenceChip(t.confidence)}
              {verdictButtons(state.verdict, (v) => set({ verdict: v }))}
            </div>
            {t.needs_attention && state.verdict === "undecided" && (
              <p className="mb-1.5 rounded bg-(--badge-stale-bg) px-2 py-1 text-(--badge-stale-fg) text-[11px]">
                ⚠ Needs attention — the AI was unsure. Accept or reject
                explicitly.
              </p>
            )}
            <p className="mb-2 border-(--ai-origin) border-l-2 pl-2 text-muted-foreground text-xs italic">
              "{t.source_quote}"
            </p>
            <div className="flex flex-wrap gap-1.5">
              <select
                aria-label="Assignee"
                value={state.assigneeId ?? ""}
                onChange={(e) => set({ assigneeId: e.target.value || null })}
                className={`${inputCls} ${!state.assigneeId ? "border-(--badge-overdue)" : ""}`}
              >
                <option value="">Assignee?</option>
                {options.members.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name.split(" ")[0]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Column"
                value={state.columnId}
                onChange={(e) => set({ columnId: e.target.value })}
                className={inputCls}
              >
                {options.columns.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Type"
                value={state.typeId}
                onChange={(e) => set({ typeId: e.target.value })}
                className={inputCls}
              >
                {options.types.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Project"
                value={state.projectId ?? ""}
                onChange={(e) => set({ projectId: e.target.value || null })}
                className={inputCls}
              >
                <option value="">No project</option>
                {options.projects.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Priority"
                value={state.priority}
                onChange={(e) =>
                  set({ priority: e.target.value as "p1" | "p2" | "p3" })
                }
                className={inputCls}
              >
                <option value="p1">P1</option>
                <option value="p2">P2</option>
                <option value="p3">P3</option>
              </select>
              {options.objectives.length > 0 && (
                <select
                  aria-label="Objective"
                  value={state.objectiveId ?? ""}
                  onChange={(e) => set({ objectiveId: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="">No objective</option>
                  {options.objectives.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {selectedType?.isExternal && (
              <div className="mt-1.5 flex gap-1.5">
                <input
                  value={state.requesterName ?? ""}
                  onChange={(e) =>
                    set({ requesterName: e.target.value || null })
                  }
                  placeholder="Requested by"
                  className={inputCls}
                />
                <input
                  value={state.requesterDepartment ?? ""}
                  onChange={(e) =>
                    set({ requesterDepartment: e.target.value || null })
                  }
                  placeholder="Department"
                  className={inputCls}
                />
              </div>
            )}
            {selectedColumn?.isBlocked && (
              <p className="mt-1.5 text-(--col-blocked-fg) text-[11px]">
                Lands in the blocked column — the source quote becomes the
                blocked reason.
              </p>
            )}
          </div>
        );
      })}

      {m_section(
        `Updates to existing tasks (${extraction.tasks_update.length})`,
        extraction.tasks_update.length,
      )}
      {extraction.tasks_update.map((u, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: extraction arrays are immutable per proposal
          key={`upd-${i}`}
          className={cardCls(updates[i], u.needs_attention)}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-card-foreground text-sm">
                <span className="font-mono text-muted-foreground">
                  EH-{u.task_number}
                </span>{" "}
                {u.note ?? "Update"}
              </p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {[
                  u.column ? `→ ${u.column}` : null,
                  u.assignee ? `assignee → ${u.assignee}` : null,
                  u.priority ? `priority → ${u.priority.toUpperCase()}` : null,
                  u.due_date ? `due → ${u.due_date}` : null,
                  u.blocked_reason ? `blocked: ${u.blocked_reason}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-1 border-(--ai-origin) border-l-2 pl-2 text-muted-foreground text-xs italic">
                "{u.source_quote}"
              </p>
            </div>
            {confidenceChip(u.confidence)}
            {verdictButtons(updates[i], (v) =>
              setUpdates((prev) => prev.map((x, j) => (j === i ? v : x))),
            )}
          </div>
        </div>
      ))}

      {m_section(
        `Objectives (${extraction.objectives.length})`,
        extraction.objectives.length,
      )}
      {extraction.objectives.map((o, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: extraction arrays are immutable per proposal
          key={`obj-${i}`}
          className={cardCls(objectives[i], o.needs_attention)}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-card-foreground text-sm">
                {o.action === "create" ? "New objective: " : "Update: "}
                {o.title}
                {o.state ? ` → ${o.state}` : ""}
              </p>
              <p className="mt-1 border-(--ai-origin) border-l-2 pl-2 text-muted-foreground text-xs italic">
                "{o.source_quote}"
              </p>
            </div>
            {confidenceChip(o.confidence)}
            {verdictButtons(objectives[i], (v) =>
              setObjectives((prev) => prev.map((x, j) => (j === i ? v : x))),
            )}
          </div>
        </div>
      ))}

      {m_section(
        `Decisions (${extraction.decisions.length})`,
        extraction.decisions.length,
      )}
      {extraction.decisions.map((d, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: extraction arrays are immutable per proposal
          key={`dec-${i}`}
          className={cardCls(decisions[i], d.needs_attention)}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-card-foreground text-sm">
                {d.text}
              </p>
              {d.context && (
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {d.context}
                </p>
              )}
            </div>
            {confidenceChip(d.confidence)}
            {verdictButtons(decisions[i], (v) =>
              setDecisions((prev) => prev.map((x, j) => (j === i ? v : x))),
            )}
          </div>
        </div>
      ))}

      <section className="rounded-lg border border-(--ai-ring)/40 bg-card p-4">
        <h2 className="font-medium text-card-foreground text-sm">
          Not what you wanted? Tell the AI.
        </h2>
        <p className="mt-0.5 mb-2 text-muted-foreground text-xs">
          Describe what to change — grouping, owners, missing items, wrong
          splits. The AI revises the whole proposal, and repeated corrections
          tune this meeting type's instructions over time.
        </p>
        <div className="flex gap-2">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder='e.g. "Print jobs should be separate tasks per item, and EH-12 belongs to Nikoloz"'
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            disabled={pending !== null || feedback.trim().length < 3}
            onClick={submitFeedback}
            className="shrink-0 self-end rounded-md border border-(--ai-origin) px-3 py-2 text-(--ai-origin-fg) text-sm hover:bg-(--ai-origin-bg) disabled:opacity-50"
          >
            {pending === "feedback" ? "Revising…" : "✦ Revise"}
          </button>
        </div>
      </section>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <footer className="fixed inset-x-0 bottom-0 border-border border-t bg-surface-1/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <p className="text-muted-foreground text-xs">
            {acceptedCount} accepted
            {undecidedCount > 0 && (
              <span className="ml-2 text-(--badge-stale-fg)">
                · {undecidedCount} need attention
              </span>
            )}
          </p>
          <button
            type="button"
            disabled={pending !== null || undecidedCount > 0}
            onClick={confirm}
            title={
              undecidedCount > 0 ? "Resolve the flagged items first" : undefined
            }
            className="ml-auto rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            {pending === "confirm"
              ? "Applying…"
              : `Confirm ${acceptedCount} accepted`}
          </button>
        </div>
      </footer>
    </div>
  );
}

function m_section(title: string, count: number) {
  if (count === 0) return null;
  return (
    <h2 className="pt-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
      {title}
    </h2>
  );
}
