"use client";

import Link from "next/link";
import { useState } from "react";
import { startMeeting } from "@/lib/actions/meetings";

type TemplateDto = {
  baseId: string;
  name: string;
  cadence: string | null;
  durationMinutes: number | null;
  participants: string | null;
};

type MeetingRowDto = {
  id: string;
  date: string;
  status: string;
  templateName: string;
  createdByName: string;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-(--obj-planned-bg) text-(--obj-planned-fg)",
  submitted: "bg-(--obj-active-bg) text-(--obj-active-fg)",
  processed: "bg-(--ai-origin-bg) text-(--ai-origin-fg)",
  confirmed: "bg-(--obj-achieved-bg) text-(--obj-achieved-fg)",
  pending_processing: "bg-(--badge-stale-bg) text-(--badge-stale-fg)",
};

export function MeetingsScreen({
  templates,
  meetings,
  canStart,
}: {
  templates: TemplateDto[];
  meetings: MeetingRowDto[];
  canStart: boolean;
}) {
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-semibold text-foreground text-xl">Meetings</h1>
      {error && (
        <p className="rounded-md bg-(--badge-overdue-bg) px-3 py-2 text-(--badge-overdue-fg) text-sm">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Start a meeting
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.baseId}
              className="flex flex-col rounded-lg border border-border bg-card p-4"
            >
              <h3 className="font-medium text-card-foreground text-sm">
                {t.name}
              </h3>
              <p className="mt-0.5 flex-1 text-muted-foreground text-xs">
                {t.cadence} · {t.durationMinutes} min · {t.participants}
              </p>
              {canStart && (
                <button
                  type="button"
                  disabled={starting === t.baseId}
                  onClick={async () => {
                    setStarting(t.baseId);
                    setError(null);
                    try {
                      await startMeeting({ templateBaseId: t.baseId });
                    } catch (err) {
                      // redirect() throws internally; only surface real errors
                      if (
                        err instanceof Error &&
                        !err.message.includes("NEXT_REDIRECT")
                      ) {
                        setError(err.message);
                        setStarting(null);
                      }
                    }
                  }}
                  className="mt-3 rounded-md bg-primary py-1.5 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {starting === t.baseId ? "Opening…" : "Start"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Past meetings
        </h2>
        {meetings.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
            No meetings yet — start the first one above.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {meetings.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/meetings/${m.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                    {m.templateName}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {m.createdByName.split(" ")[0]}
                  </span>
                  <span className="font-mono text-muted-foreground text-xs">
                    {new Date(m.date).toLocaleDateString()}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] capitalize ${
                      STATUS_STYLE[m.status] ?? ""
                    }`}
                  >
                    {m.status.replaceAll("_", " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
