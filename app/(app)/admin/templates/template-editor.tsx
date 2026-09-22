"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveTemplateVersion } from "@/lib/actions/templates";
import { CONTEXT_QUERIES, type TemplateSection } from "@/lib/schemas/meeting";

const inputCls =
  "rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

type TemplateDto = {
  baseId: string;
  name: string;
  version: number;
  durationMinutes: number | null;
  scheduleDow: number[];
  scheduleTime: string | null;
  scheduleEnabled: boolean;
  extractionInstructions: string | null;
  sections: TemplateSection[];
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TemplateEditor({ templates }: { templates: TemplateDto[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(templates[0]?.baseId ?? "");
  const source = templates.find((t) => t.baseId === selectedId);
  const [draft, setDraft] = useState<TemplateDto | null>(source ?? null);
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  function select(baseId: string) {
    setSelectedId(baseId);
    setDraft(templates.find((t) => t.baseId === baseId) ?? null);
    setError(null);
  }

  function patchSection(i: number, patch: Partial<TemplateSection>) {
    if (!draft) return;
    setDraft({
      ...draft,
      sections: draft.sections.map((s, j) =>
        j === i ? { ...s, ...patch } : s,
      ),
    });
  }

  if (!draft) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-semibold text-foreground text-xl">
          Meeting templates
        </h1>
        <select
          value={selectedId}
          onChange={(e) => select(e.target.value)}
          className={`${inputCls} ml-auto`}
          aria-label="Template"
        >
          {templates.map((t) => (
            <option key={t.baseId} value={t.baseId}>
              {t.name} (v{t.version})
            </option>
          ))}
        </select>
      </div>
      <p className="text-muted-foreground text-sm">
        Saving creates version {draft.version + 1}; past meetings keep rendering
        with the version they used.
      </p>
      {error && (
        <p className="rounded-md bg-(--badge-overdue-bg) px-3 py-2 text-(--badge-overdue-fg) text-sm">
          {error}
        </p>
      )}

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          Schedule
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={draft.scheduleEnabled}
              onChange={(e) =>
                setDraft({ ...draft, scheduleEnabled: e.target.checked })
              }
            />
            Scheduled
          </label>
          {DOW.map((d, i) => (
            <label key={d} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={draft.scheduleDow.includes(i + 1)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    scheduleDow: e.target.checked
                      ? [...draft.scheduleDow, i + 1].sort()
                      : draft.scheduleDow.filter((x) => x !== i + 1),
                  })
                }
              />
              {d}
            </label>
          ))}
          <input
            type="time"
            value={draft.scheduleTime ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, scheduleTime: e.target.value || null })
            }
            className={inputCls}
            aria-label="Time"
          />
          <input
            type="number"
            min={5}
            max={240}
            value={draft.durationMinutes ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                durationMinutes: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="min"
            className={`${inputCls} w-20`}
            aria-label="Duration minutes"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
          AI extraction instructions (tuned automatically over time)
        </h2>
        <textarea
          value={draft.extractionInstructions ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              extractionInstructions: e.target.value || null,
            })
          }
          rows={4}
          className={`${inputCls} w-full font-mono text-xs`}
        />
      </section>

      <section className="space-y-3">
        {draft.sections.map((s, i) => (
          <div
            key={s.id}
            className="space-y-2 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={s.title}
                onChange={(e) => patchSection(i, { title: e.target.value })}
                className={`${inputCls} min-w-48 flex-1 font-medium`}
                aria-label="Section title"
              />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={s.perPerson}
                  onChange={(e) =>
                    patchSection(i, { perPerson: e.target.checked })
                  }
                />
                per person
              </label>
              <select
                value={s.context ?? ""}
                onChange={(e) =>
                  patchSection(i, {
                    context: (e.target.value ||
                      undefined) as TemplateSection["context"],
                  })
                }
                className={`${inputCls} text-xs`}
                aria-label="Auto-loaded board context"
              >
                <option value="">no board context</option>
                {CONTEXT_QUERIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    sections: draft.sections.filter((_, j) => j !== i),
                  })
                }
                className="rounded-md border border-border px-2 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-destructive"
              >
                Remove section
              </button>
            </div>
            <input
              value={s.description ?? ""}
              onChange={(e) =>
                patchSection(i, { description: e.target.value || undefined })
              }
              placeholder="Section description (optional)"
              className={`${inputCls} w-full text-xs`}
            />
            {s.questions.map((q, qi) => (
              <div key={q.id} className="flex items-center gap-2 pl-4">
                <input
                  value={q.label}
                  onChange={(e) =>
                    patchSection(i, {
                      questions: s.questions.map((x, xj) =>
                        xj === qi ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                  className={`${inputCls} flex-1 text-xs`}
                  aria-label="Question"
                />
                <select
                  value={q.kind}
                  onChange={(e) =>
                    patchSection(i, {
                      questions: s.questions.map((x, xj) =>
                        xj === qi
                          ? { ...x, kind: e.target.value as typeof q.kind }
                          : x,
                      ),
                    })
                  }
                  className={`${inputCls} text-xs`}
                  aria-label="Question kind"
                >
                  <option value="short">short</option>
                  <option value="long">long</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    patchSection(i, {
                      questions: s.questions.filter((_, xj) => xj !== qi),
                    })
                  }
                  className="text-muted-foreground text-xs hover:text-destructive"
                  aria-label="Remove question"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patchSection(i, {
                  questions: [
                    ...s.questions,
                    {
                      id: `q${Date.now()}`,
                      label: "New question",
                      kind: "long",
                    },
                  ],
                })
              }
              className="ml-4 rounded-md border border-border px-2 py-0.5 text-muted-foreground text-xs hover:bg-accent"
            >
              + question
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDraft({
              ...draft,
              sections: [
                ...draft.sections,
                {
                  id: `s${Date.now()}`,
                  title: "New section",
                  perPerson: false,
                  questions: [
                    { id: `q${Date.now()}`, label: "Question", kind: "long" },
                  ],
                },
              ],
            })
          }
          className="rounded-md border border-border px-3 py-1.5 text-muted-foreground text-sm hover:bg-accent"
        >
          + Add section
        </button>
      </section>

      <button
        type="button"
        disabled={state === "saving"}
        onClick={async () => {
          setState("saving");
          setError(null);
          try {
            await saveTemplateVersion({
              baseId: draft.baseId,
              extractionInstructions: draft.extractionInstructions,
              durationMinutes: draft.durationMinutes,
              scheduleDow: draft.scheduleDow,
              scheduleTime: draft.scheduleTime,
              scheduleEnabled: draft.scheduleEnabled,
              sections: draft.sections,
            });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          } finally {
            setState("idle");
          }
        }}
        className="rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
      >
        {state === "saving"
          ? "Saving…"
          : `Save as version ${draft.version + 1}`}
      </button>
    </div>
  );
}
