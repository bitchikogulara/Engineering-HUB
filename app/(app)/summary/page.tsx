import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { weeklySummary } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { hasPermission } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { SummaryEditor } from "./summary-editor";

export const metadata: Metadata = { title: "Weekly summary" };
export const dynamic = "force-dynamic";

export default async function SummaryPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "meeting.submit")) {
    redirect("/dashboard");
  }
  const summaries = await db
    .select()
    .from(weeklySummary)
    .orderBy(desc(weeklySummary.weekStart))
    .limit(8);
  const base = serverEnv().APP_URL ?? serverEnv().BETTER_AUTH_URL;

  return (
    <SummaryEditor
      summaries={summaries.map((s) => ({
        id: s.id,
        weekStart: s.weekStart,
        content: s.content,
        shareUrl:
          s.shareToken && !s.revokedAt ? `${base}/share/${s.shareToken}` : null,
        updatedAt: s.updatedAt.toISOString(),
      }))}
    />
  );
}
