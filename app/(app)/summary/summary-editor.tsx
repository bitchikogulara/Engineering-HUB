"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  generateWeeklySummary,
  publishSummary,
  revokeSummary,
  saveWeeklySummary,
} from "@/lib/actions/summary";

type SummaryDto = {
  id: string;
  weekStart: string;
  content: string;
  shareUrl: string | null;
  updatedAt: string;
};

export function SummaryEditor({ summaries }: { summaries: SummaryDto[] }) {
  const router = useRouter();
  const current = summaries[0] ?? null;
  const [content, setContent] = useState(current?.content ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(name: string, fn: () => Promise<unknown>) {
    setPending(name);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-semibold text-foreground text-xl">
          Weekly summary
        </h1>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run("generate", generateWeeklySummary)}
          className="ml-auto rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
        >
          {pending === "generate"
            ? "Drafting… (~10s)"
            : current
              ? "✦ Re-draft from this week"
              : "✦ Draft from this week"}
        </button>
      </div>
      <p className="text-muted-foreground text-sm">
        Auto-drafted from the week's confirmed meetings and board activity —
        edit before sharing. The share link is revocable any time.
      </p>
      {error && (
        <p className="rounded-md bg-(--badge-overdue-bg) px-3 py-2 text-(--badge-overdue-fg) text-sm">
          {error}
        </p>
      )}

      {current ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="font-mono text-muted-foreground text-xs">
            Week of {current.weekStart} · updated{" "}
            {new Date(current.updatedAt).toLocaleString()}
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending !== null || content === current.content}
              onClick={() =>
                run("save", () =>
                  saveWeeklySummary({ id: current.id, content }),
                )
              }
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              {pending === "save" ? "Saving…" : "Save edits"}
            </button>
            {current.shareUrl ? (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(current.shareUrl ?? "");
                    setCopied(true);
                  }}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  {copied ? "Copied ✓" : "Copy share link"}
                </button>
                <a
                  href={`/api/summary/${current.id}/pdf`}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  Download PDF
                </a>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() =>
                    run("revoke", () => revokeSummary({ id: current.id }))
                  }
                  className="rounded-md border border-border px-3 py-1.5 text-muted-foreground text-sm hover:bg-accent hover:text-destructive disabled:opacity-50"
                >
                  Revoke link
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() =>
                    run("publish", () => publishSummary({ id: current.id }))
                  }
                  className="rounded-md bg-(--obj-achieved) px-3 py-1.5 font-medium text-sm text-white hover:opacity-90 disabled:opacity-50"
                >
                  {pending === "publish" ? "Publishing…" : "Create share link"}
                </button>
                <a
                  href={`/api/summary/${current.id}/pdf`}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  Download PDF
                </a>
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
          No summary yet — draft one from this week's activity above.
        </p>
      )}

      {summaries.length > 1 && (
        <section>
          <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Previous weeks
          </h2>
          <ul className="space-y-2">
            {summaries.slice(1).map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <p className="font-mono text-muted-foreground text-xs">
                  Week of {s.weekStart}
                </p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-card-foreground text-sm">
                  {s.content}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
