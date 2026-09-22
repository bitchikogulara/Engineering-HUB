"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { retryProcessing } from "@/lib/actions/ai";

/** Live processing state (FR-25): submit returns immediately, this polls. */
export function AiStatusPanel({
  meetingId,
  templateName,
  status,
  canAct,
}: {
  meetingId: string;
  templateName: string;
  status: "submitted" | "processing" | "pending_processing";
  canAct: boolean;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const processing = status !== "pending_processing";

  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [processing, router]);

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 text-center">
      <h1 className="mb-2 font-medium text-card-foreground">{templateName}</h1>
      {processing ? (
        <>
          <p className="mb-3 text-2xl" aria-hidden>
            ✦
          </p>
          <p className="text-foreground text-sm">
            Extracting tasks, objectives and decisions…
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Usually 10–30 seconds. This page updates by itself.
          </p>
          <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-(--ai-origin)" />
          </div>
        </>
      ) : (
        <>
          <p className="text-foreground text-sm">
            Processing failed — the meeting record is safe, nothing was lost.
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            This usually means the AI service was briefly unreachable.
          </p>
          {canAct && (
            <button
              type="button"
              disabled={retrying}
              onClick={async () => {
                setRetrying(true);
                try {
                  await retryProcessing({ meetingId });
                  router.refresh();
                } finally {
                  setRetrying(false);
                }
              }}
              className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
            >
              {retrying ? "Retrying…" : "Retry processing"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
