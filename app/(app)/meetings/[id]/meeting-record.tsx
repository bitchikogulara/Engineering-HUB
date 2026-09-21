import type { MeetingAnswers, TemplateSection } from "@/lib/schemas/meeting";

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted — awaiting AI processing (phase 3)",
  processed: "Processed — awaiting confirmation",
  confirmed: "Confirmed",
  pending_processing: "Pending processing — retry available",
};

/** Read-only view of a submitted meeting (immutable record, FR-18). */
export function MeetingRecord({
  templateName,
  date,
  sections,
  participants,
  answers,
  freeText,
  status,
}: {
  meetingId: string;
  templateName: string;
  date: string;
  sections: TemplateSection[];
  participants: { id: string; name: string }[];
  answers: MeetingAnswers;
  freeText: string | null;
  status: string;
}) {
  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-semibold text-foreground text-xl">
            {templateName}
          </h1>
          <span className="rounded bg-(--obj-active-bg) px-2 py-0.5 text-(--obj-active-fg) text-xs">
            {STATUS_LABEL[status] ?? status}
          </span>
          <span className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground text-xs">
            🔒 immutable record
          </span>
        </div>
        <p className="mt-1 text-muted-foreground text-xs">
          {new Date(date).toLocaleString()} ·{" "}
          {participants.map((p) => p.name.split(" ")[0]).join(", ")}
        </p>
      </header>

      {sections.map((section) => (
        <section
          key={section.id}
          className="rounded-lg border border-border bg-card p-4"
        >
          <h2 className="mb-2 font-medium text-card-foreground text-sm">
            {section.title}
          </h2>
          {Object.entries(answers[section.id] ?? {}).map(
            ([personKey, byQuestion]) => (
              <div key={personKey} className="mb-3 last:mb-0">
                {section.perPerson && (
                  <p className="mb-1 font-medium text-foreground text-xs">
                    {nameOf(personKey)}
                  </p>
                )}
                {section.questions.map((q) => {
                  const value = byQuestion[q.id];
                  if (!value?.trim()) return null;
                  return (
                    <div key={q.id} className="mb-2">
                      <p className="text-[11px] text-muted-foreground">
                        {q.label}
                      </p>
                      <p className="whitespace-pre-wrap text-foreground text-sm">
                        {value}
                      </p>
                    </div>
                  );
                })}
              </div>
            ),
          )}
          {!answers[section.id] && (
            <p className="text-muted-foreground text-xs">No answers.</p>
          )}
        </section>
      ))}

      {freeText && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 font-medium text-card-foreground text-sm">
            Additional notes
          </h2>
          <p className="whitespace-pre-wrap text-foreground text-sm">
            {freeText}
          </p>
        </section>
      )}
    </div>
  );
}
