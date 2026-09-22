"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { answerClarifications } from "@/lib/actions/ai";

/** FR-21: one batch of ≤5 questions, each answerable or skippable. */
export function ClarificationForm({
  meetingId,
  templateName,
  questions,
}: {
  meetingId: string;
  templateName: string;
  questions: { id: string; question: string }[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await answerClarifications({
        meetingId,
        answers: Object.fromEntries(
          questions.map((q) => [
            q.id,
            skipped.has(q.id) ? null : (answers[q.id]?.trim() ?? null) || null,
          ]),
        ),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="font-semibold text-foreground text-xl">
          {templateName}
        </h1>
        <p className="text-muted-foreground text-sm">
          The AI needs {questions.length} clarification
          {questions.length > 1 ? "s" : ""} before proposing board changes.
          Anything you skip stays in the proposal marked "needs attention".
        </p>
      </header>

      {questions.map((q, i) => (
        <div
          key={q.id}
          className={`rounded-lg border bg-card p-4 ${
            skipped.has(q.id)
              ? "border-border opacity-60"
              : "border-(--ai-ring)/40"
          }`}
        >
          <p className="mb-2 text-card-foreground text-sm">
            <span className="mr-1.5 rounded bg-(--ai-origin-bg) px-1.5 py-0.5 font-mono text-(--ai-origin-fg) text-[11px]">
              Q{i + 1}
            </span>
            {q.question}
          </p>
          <div className="flex gap-2">
            <input
              value={answers[q.id] ?? ""}
              disabled={skipped.has(q.id)}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
              }
              placeholder="Your answer…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() =>
                setSkipped((prev) => {
                  const next = new Set(prev);
                  if (next.has(q.id)) next.delete(q.id);
                  else next.add(q.id);
                  return next;
                })
              }
              className="shrink-0 rounded-md border border-border px-3 text-muted-foreground text-xs hover:bg-accent"
            >
              {skipped.has(q.id) ? "Unskip" : "Skip"}
            </button>
          </div>
        </div>
      ))}

      {error && <p className="text-destructive text-sm">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-md bg-primary py-2.5 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send answers → revised proposal"}
      </button>
    </div>
  );
}
