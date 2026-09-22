import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { weeklySummary } from "@/db/schema";

// Public, token-based, revocable (FR-35). Shows ONLY the published summary —
// no navigation, no other data, no auth session.

export const metadata: Metadata = { title: "Engineering — weekly summary" };
export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [summary] = await db
    .select()
    .from(weeklySummary)
    .where(
      and(eq(weeklySummary.shareToken, token), isNull(weeklySummary.revokedAt)),
    );

  if (!summary) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6">
        <p className="text-muted-foreground text-sm">
          This link is no longer available.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-background p-6 print:p-0">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground">
          E
        </span>
        <div>
          <h1 className="font-semibold text-foreground leading-tight">
            Engineering — weekly summary
          </h1>
          <p className="font-mono text-muted-foreground text-xs">
            Week of {summary.weekStart} · Transporter Group
          </p>
        </div>
      </header>
      <article className="whitespace-pre-wrap rounded-lg border border-border bg-card p-6 text-card-foreground text-sm leading-relaxed print:border-0 print:p-0">
        {summary.content}
      </article>
    </main>
  );
}
