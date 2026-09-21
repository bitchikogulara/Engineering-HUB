import { inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema";
import { hasPermission } from "@/lib/permissions";
import {
  getAgendaSuggestions,
  getMeetingWithTemplate,
  getSectionContext,
} from "@/lib/queries/meetings";
import { sectionsSchema } from "@/lib/schemas/meeting";
import { requireSession } from "@/lib/session";
import { MeetingForm } from "./meeting-form";
import { MeetingRecord } from "./meeting-record";

export const metadata: Metadata = { title: "Meeting" };
export const dynamic = "force-dynamic";

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const row = await getMeetingWithTemplate(id);
  if (!row) notFound();
  const { meeting: m, template } = row;

  // Viewers never see raw meeting content (FR-28)
  if (!hasPermission(session.user.role, "meeting.readRaw")) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6">
        <h1 className="mb-2 font-medium text-card-foreground">
          {template.name} · {m.date.toLocaleDateString()}
        </h1>
        <p className="text-muted-foreground text-sm">
          {m.summary ?? "No summary is available for this meeting yet."}
        </p>
      </div>
    );
  }

  const sections = sectionsSchema.parse(template.sections);
  const participants = m.participants.length
    ? await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, m.participants))
    : [];

  const isDraft = m.status === "draft";
  const [context, suggestions] = isDraft
    ? await Promise.all([
        getSectionContext(sections, m.participants),
        getAgendaSuggestions(template.agendaRules),
      ])
    : [{}, []];

  const shared = {
    meetingId: m.id,
    templateName: template.name,
    date: m.date.toISOString(),
    sections,
    participants,
    answers: (m.answers ?? {}) as Record<
      string,
      Record<string, Record<string, string>>
    >,
    freeText: m.freeText,
  };

  if (isDraft && hasPermission(session.user.role, "meeting.participate")) {
    return (
      <MeetingForm {...shared} context={context} suggestions={suggestions} />
    );
  }
  return <MeetingRecord {...shared} status={m.status} />;
}
