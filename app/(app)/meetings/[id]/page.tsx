import { desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderMeetingRecord } from "@/ai/context";
import { extractionSchema } from "@/ai/schemas";
import { db } from "@/db";
import { clarificationRound, templateSuggestion, user } from "@/db/schema";
import { hasPermission } from "@/lib/permissions";
import { getBoardConfig } from "@/lib/queries/board";
import {
  getAgendaSuggestions,
  getMeetingWithTemplate,
  getSectionContext,
} from "@/lib/queries/meetings";
import { getObjectives } from "@/lib/queries/objectives";
import { sectionsSchema } from "@/lib/schemas/meeting";
import { requireSession } from "@/lib/session";
import { AiStatusPanel } from "./ai-status";
import { ClarificationForm } from "./clarification-form";
import { MeetingForm } from "./meeting-form";
import { MeetingRecord } from "./meeting-record";
import { ProposalScreen } from "./proposal-screen";
import { SuggestionCard } from "./suggestion-card";

export const metadata: Metadata = { title: "Meeting" };
export const dynamic = "force-dynamic";

function matchByName<T extends { id: string; name: string }>(
  options: T[],
  name: string | null,
): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const exact = options.find((o) => o.name.toLowerCase() === n);
  if (exact) return exact.id;
  const first = options.find(
    (o) =>
      o.name.toLowerCase().startsWith(n) ||
      o.name.split(" ")[0].toLowerCase() === n.split(" ")[0],
  );
  return first?.id ?? null;
}

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
  const canAct = hasPermission(session.user.role, "meeting.submit");

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

  // --- draft: the live form ---
  if (m.status === "draft" && canAct) {
    const [context, suggestions] = await Promise.all([
      getSectionContext(sections, m.participants),
      getAgendaSuggestions(template.agendaRules),
    ]);
    return (
      <MeetingForm
        {...shared}
        context={context}
        suggestions={suggestions}
        currentUser={{ id: session.user.id, name: session.user.name }}
      />
    );
  }

  // --- processing / failed: live status with retry (FR-25) ---
  if (
    m.status === "submitted" ||
    m.status === "processing" ||
    m.status === "pending_processing"
  ) {
    return (
      <AiStatusPanel
        meetingId={m.id}
        templateName={template.name}
        status={m.status}
        canAct={canAct}
      />
    );
  }

  // --- clarifying: the question batch (FR-21) ---
  if (m.status === "clarifying" && canAct) {
    const [round] = await db
      .select()
      .from(clarificationRound)
      .where(eq(clarificationRound.meetingId, m.id))
      .orderBy(desc(clarificationRound.round))
      .limit(1);
    return (
      <ClarificationForm
        meetingId={m.id}
        templateName={template.name}
        questions={
          (round?.questions ?? []) as { id: string; question: string }[]
        }
      />
    );
  }

  // --- proposed: the signature proposal screen (FR-23, FR-46) ---
  if (m.status === "proposed" && canAct) {
    const extraction = extractionSchema.parse(m.extraction);
    const [config, objectives] = await Promise.all([
      getBoardConfig(),
      getObjectives(),
    ]);
    const memberOpts = config.members.map((u) => ({ id: u.id, name: u.name }));
    const projectOpts = config.projects.map((p) => ({
      id: p.id,
      name: p.name,
    }));
    const typeOpts = config.types.map((t) => ({
      id: t.id,
      name: t.name,
      isExternal: t.isExternal,
    }));
    const objectiveOpts = objectives
      .filter((o) => o.state === "active" || o.state === "planned")
      .map((o) => ({ id: o.id, name: o.title }));
    const columnOpts = config.columns.map((c) => ({
      id: c.id,
      name: c.name,
      isBlocked: c.isBlocked,
    }));
    const defaultColumn =
      config.columns.find((c) => !c.isDone && !c.isBlocked && c.position > 1) ??
      config.columns[0];
    const internalType = typeOpts.find((t) => !t.isExternal) ?? typeOpts[0];

    const sourceText = renderMeetingRecord({
      templateName: template.name,
      date: m.date,
      sections,
      answers: shared.answers as never,
      freeText: m.freeText,
      participantNames: new Map(participants.map((p) => [p.id, p.name])),
    });

    return (
      <ProposalScreen
        meetingId={m.id}
        templateName={template.name}
        sourceText={sourceText}
        extraction={extraction}
        options={{
          members: memberOpts,
          projects: projectOpts,
          types: typeOpts,
          objectives: objectiveOpts,
          columns: columnOpts,
        }}
        prefills={extraction.tasks_new.map((t) => ({
          assigneeId: matchByName(memberOpts, t.assignee),
          projectId: matchByName(projectOpts, t.project),
          typeId: matchByName(typeOpts, t.type) ?? internalType?.id ?? "",
          objectiveId: matchByName(objectiveOpts, t.objective),
          columnId: matchByName(columnOpts, t.column) ?? defaultColumn.id,
        }))}
      />
    );
  }

  // --- confirmed (or read-only): the immutable record (FR-18) ---
  const suggestions =
    m.status === "confirmed" &&
    hasPermission(session.user.role, "template.edit")
      ? await db
          .select()
          .from(templateSuggestion)
          .where(eq(templateSuggestion.meetingId, m.id))
      : [];
  const pending = suggestions.find((s) => s.status === "pending");

  return (
    <div className="space-y-4">
      {pending && (
        <div className="mx-auto max-w-3xl">
          <SuggestionCard
            id={pending.id}
            templateName={template.name}
            current={template.extractionInstructions ?? ""}
            proposed={pending.proposedInstructions}
            rationale={pending.rationale}
          />
        </div>
      )}
      <MeetingRecord
        {...shared}
        status={m.status}
        appliedResult={
          m.appliedResult as Record<string, Record<string, unknown[]>> | null
        }
      />
    </div>
  );
}
