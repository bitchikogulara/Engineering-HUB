import { desc, eq, ilike, or } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { decision, meeting, meetingTemplate } from "@/db/schema";
import { hasPermission } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { DecisionForm } from "./decision-form";

export const metadata: Metadata = { title: "Decisions" };
export const dynamic = "force-dynamic";

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const { q = "" } = await searchParams;
  const canEdit = hasPermission(session.user.role, "decision.manage");

  const rows = await db
    .select({
      id: decision.id,
      text: decision.text,
      context: decision.context,
      date: decision.date,
      createdByType: decision.createdByType,
      meetingId: decision.meetingId,
      meetingName: meetingTemplate.name,
      meetingDate: meeting.date,
    })
    .from(decision)
    .leftJoin(meeting, eq(meeting.id, decision.meetingId))
    .leftJoin(meetingTemplate, eq(meetingTemplate.id, meeting.templateId))
    .where(
      q
        ? or(ilike(decision.text, `%${q}%`), ilike(decision.context, `%${q}%`))
        : undefined,
    )
    .orderBy(desc(decision.date), desc(decision.createdAt))
    .limit(200);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-semibold text-foreground text-xl">Decision log</h1>
      <p className="text-muted-foreground text-sm">
        The department's institutional memory — why we chose what we chose.
      </p>

      <form method="GET" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search decisions…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-border px-4 text-sm hover:bg-accent"
        >
          Search
        </button>
      </form>

      {canEdit && <DecisionForm />}

      <ol className="relative space-y-4 border-border border-l pl-5">
        {rows.map((d) => (
          <li key={d.id} className="relative">
            <span
              className="-left-[26px] absolute top-1.5 size-2.5 rounded-full"
              style={{
                background:
                  d.createdByType === "ai"
                    ? "var(--ai-origin)"
                    : "var(--primary)",
              }}
              title={
                d.createdByType === "ai" ? "Extracted by AI" : "Logged manually"
              }
            />
            <div className="rounded-lg border border-border bg-card p-3.5">
              <p className="font-medium text-card-foreground text-sm">
                {d.text}
              </p>
              {d.context && (
                <p className="mt-1 text-muted-foreground text-xs">
                  {d.context}
                </p>
              )}
              <p className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                {d.date}
                {d.createdByType === "ai" && (
                  <span className="rounded bg-(--ai-origin-bg) px-1 text-(--ai-origin-fg)">
                    ✦ AI
                  </span>
                )}
                {d.meetingId && (
                  <Link
                    href={`/meetings/${d.meetingId}`}
                    className="underline hover:text-foreground"
                  >
                    {d.meetingName} ·{" "}
                    {d.meetingDate
                      ? new Date(d.meetingDate).toLocaleDateString()
                      : ""}
                  </Link>
                )}
              </p>
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-muted-foreground text-sm">
            {q ? `Nothing found for “${q}”.` : "No decisions yet."}
          </li>
        )}
      </ol>
    </div>
  );
}
