"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { resolveTemplateSuggestion } from "@/lib/actions/ai";

/** FR-47: AI-proposed instruction edit — applied only on admin approval. */
export function SuggestionCard({
  id,
  templateName,
  current,
  proposed,
  rationale,
}: {
  id: string;
  templateName: string;
  current: string;
  proposed: string;
  rationale: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function resolve(apply: boolean) {
    setPending(true);
    try {
      await resolveTemplateSuggestion({ id, apply });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-(--ai-ring)/50 bg-(--ai-origin-bg)/30 p-4">
      <p className="font-medium text-foreground text-sm">
        ✦ Based on your feedback, update the "{templateName}" extraction
        instructions?
      </p>
      <p className="mt-1 text-muted-foreground text-xs">{rationale}</p>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-2 rounded-md border border-border px-2 py-0.5 text-muted-foreground text-xs hover:bg-accent"
      >
        {expanded ? "Hide" : "Show"} diff
      </button>
      {expanded && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground uppercase">
              Current
            </p>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-2 text-[11px] text-muted-foreground">
              {current || "(none)"}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground uppercase">
              Proposed
            </p>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-(--ai-ring)/40 bg-surface-2 p-2 text-[11px] text-foreground">
              {proposed}
            </pre>
          </div>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => resolve(true)}
          className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs hover:opacity-90 disabled:opacity-50"
        >
          Apply (new template version)
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => resolve(false)}
          className="rounded-md border border-border px-3 py-1.5 text-muted-foreground text-xs hover:bg-accent disabled:opacity-50"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
