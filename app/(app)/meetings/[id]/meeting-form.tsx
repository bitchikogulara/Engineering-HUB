"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteDraftMeeting,
  dismissSuggestion,
  getMeetingLiveState,
  saveMeeting,
  submitMeeting,
} from "@/lib/actions/meetings";
import type { ContextCard } from "@/lib/queries/meetings";
import { useRealtimeChannel } from "@/lib/realtime";
import type {
  FieldPatch,
  MeetingAnswers,
  TemplateSection,
} from "@/lib/schemas/meeting";

// A locally edited field is shielded from poll merges for this long, so an
// in-flight stale read can never roll back what was just typed.
const EDIT_SHIELD_MS = 8_000;

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

type Suggestion = { key: string; source: string; text: string };

export function MeetingForm({
  meetingId,
  templateName,
  date,
  sections,
  participants,
  answers: initialAnswers,
  freeText: initialFreeText,
  context,
  suggestions: initialSuggestions,
  currentUser,
}: {
  meetingId: string;
  templateName: string;
  date: string;
  sections: TemplateSection[];
  participants: { id: string; name: string }[];
  answers: MeetingAnswers;
  freeText: string | null;
  context: Record<string, Record<string, ContextCard[]>>;
  suggestions: Suggestion[];
  currentUser: { id: string; name: string; role: string };
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<MeetingAnswers>(initialAnswers);
  const [freeText, setFreeText] = useState(initialFreeText ?? "");
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">(
    "saved",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ answers, freeText });
  latest.current = { answers, freeText };
  const focusedField = useRef<string | null>(null);
  const [others, setOthers] = useState<string[]>([]);
  // Unsaved field patches (keyed section:person:question) + when each field
  // was last touched locally — both guard the reconcile poll.
  const pending = useRef(new Map<string, FieldPatch>());
  const freeTextDirty = useRef(false);
  const editedAt = useRef(new Map<string, number>());

  // Everyone fills their own per-person block; admins can fill in for
  // someone who is absent.
  const canEditAll = currentUser.role === "admin";
  const canEdit = (section: TemplateSection, personId: string) =>
    !section.perPerson || personId === currentUser.id || canEditAll;

  // Field-level live co-editing (ADR-007): last write wins per field; the
  // field you are typing in is never overwritten by a peer.
  const broadcast = useRealtimeChannel(`meeting:${meetingId}`, {
    presence: { key: currentUser.id, name: currentUser.name },
    onPresence: (names) =>
      setOthers(names.filter((n) => n !== currentUser.name)),
    onMessage: (event, payload) => {
      if (event === "patch") {
        const p = payload as {
          sectionId: string;
          personKey: string;
          questionId: string;
          value: string;
        };
        const key = `${p.sectionId}:${p.personKey}:${p.questionId}`;
        if (focusedField.current === key) return;
        setAnswers((prev) => ({
          ...prev,
          [p.sectionId]: {
            ...prev[p.sectionId],
            [p.personKey]: {
              ...prev[p.sectionId]?.[p.personKey],
              [p.questionId]: p.value,
            },
          },
        }));
      } else if (event === "freeText") {
        if (focusedField.current === "freeText") return;
        setFreeText((payload as { value: string }).value);
      } else if (event === "submitted") {
        router.refresh();
      }
    },
  });

  // Autosave ≤5 s after the last keystroke (FR-15); DB is the durability
  // layer. Only the fields this client actually changed are sent — the
  // server merges them, so simultaneous editors never overwrite each other.
  const flushSave = useCallback(async () => {
    const sent = [...pending.current.entries()];
    const ftSent = freeTextDirty.current ? latest.current.freeText : undefined;
    if (sent.length === 0 && ftSent === undefined) return;
    setSaveState("saving");
    await saveMeeting({
      id: meetingId,
      patches: sent.map(([, p]) => p),
      freeText: ftSent,
    });
    // Drop only patches that weren't superseded while the save was in flight.
    for (const [key, p] of sent) {
      if (pending.current.get(key) === p) pending.current.delete(key);
    }
    if (ftSent !== undefined && latest.current.freeText === ftSent) {
      freeTextDirty.current = false;
    }
    setSaveState(
      pending.current.size > 0 || freeTextDirty.current ? "dirty" : "saved",
    );
  }, [meetingId]);

  const scheduleSave = useCallback(() => {
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      flushSave().catch(() => {
        setSaveState("dirty"); // retry on next change; nothing is lost locally
      });
    }, 2000);
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Reconcile poll: co-editing stays live (a few seconds behind) even when
  // the realtime channel is off or a broadcast was missed, and the screen
  // advances for everyone once one person submits. Fields focused, unsaved,
  // or edited in the last few seconds are never touched by a merge.
  useEffect(() => {
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const state = await getMeetingLiveState({ id: meetingId });
        if (stopped) return;
        if (state.status !== "draft") {
          router.refresh();
          return;
        }
        const cutoff = Date.now() - EDIT_SHIELD_MS;
        const mergeable = (key: string) =>
          focusedField.current !== key &&
          !pending.current.has(key) &&
          (editedAt.current.get(key) ?? 0) < cutoff;
        setAnswers((prev) => {
          let next = prev;
          for (const [sid, people] of Object.entries(state.answers)) {
            for (const [pid, fields] of Object.entries(people)) {
              for (const [qid, value] of Object.entries(fields)) {
                const key = `${sid}:${pid}:${qid}`;
                if ((next[sid]?.[pid]?.[qid] ?? "") === value) continue;
                if (!mergeable(key)) continue;
                next = {
                  ...next,
                  [sid]: {
                    ...next[sid],
                    [pid]: { ...next[sid]?.[pid], [qid]: value },
                  },
                };
              }
            }
          }
          return next;
        });
        if (!freeTextDirty.current && mergeable("freeText")) {
          const value = state.freeText ?? "";
          setFreeText((cur) => (cur === value ? cur : value));
        }
      } catch {
        // transient — next tick retries
      }
    }, 4000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [meetingId, router]);

  function setAnswer(
    sectionId: string,
    personKey: string,
    questionId: string,
    value: string,
  ) {
    setAnswers((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        [personKey]: {
          ...prev[sectionId]?.[personKey],
          [questionId]: value,
        },
      },
    }));
    const key = `${sectionId}:${personKey}:${questionId}`;
    pending.current.set(key, { sectionId, personKey, questionId, value });
    editedAt.current.set(key, Date.now());
    broadcast("patch", { sectionId, personKey, questionId, value });
    scheduleSave();
  }

  function markFreeTextEdited() {
    freeTextDirty.current = true;
    editedAt.current.set("freeText", Date.now());
  }

  function insertSuggestion(s: Suggestion) {
    setFreeText((prev) =>
      prev ? `${prev}\n- [${s.source}] ${s.text}` : `- [${s.source}] ${s.text}`,
    );
    setSuggestions((prev) => prev.filter((x) => x.key !== s.key));
    markFreeTextEdited();
    scheduleSave();
  }

  async function handleDismiss(s: Suggestion) {
    setSuggestions((prev) => prev.filter((x) => x.key !== s.key));
    await dismissSuggestion({ key: s.key }).catch(() => {});
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await flushSave(); // everything typed here lands before the freeze
      await submitMeeting({ id: meetingId });
      broadcast("submitted", {});
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-foreground text-xl">
            {templateName}
          </h1>
          <p className="text-muted-foreground text-xs">
            {new Date(date).toLocaleString()} ·{" "}
            {participants.map((p) => p.name.split(" ")[0]).join(", ")}
          </p>
        </div>
        {others.length > 0 && (
          <span className="rounded-full bg-(--obj-active-bg) px-2 py-0.5 text-(--obj-active-fg) text-xs">
            ● {others.join(", ")} here
          </span>
        )}
        <span
          className={`font-mono text-xs ${
            saveState === "saved"
              ? "text-(--obj-achieved-fg)"
              : "text-muted-foreground"
          }`}
        >
          {saveState === "saved"
            ? "✓ saved"
            : saveState === "saving"
              ? "saving…"
              : "editing…"}
        </span>
      </header>

      {suggestions.length > 0 && (
        <section className="rounded-lg border border-border bg-surface-1 p-3">
          <p className="mb-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
            Suggested agenda items
          </p>
          <ul className="space-y-1.5">
            {suggestions.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                  {s.text}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {s.source}
                </span>
                <button
                  type="button"
                  onClick={() => insertSuggestion(s)}
                  className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent"
                  title="Insert into notes"
                >
                  ✓ Insert
                </button>
                <button
                  type="button"
                  onClick={() => void handleDismiss(s)}
                  className="rounded-md border border-border px-2 py-0.5 text-muted-foreground text-xs hover:bg-accent"
                  title="Dismiss for 7 days"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sections.map((section) => (
        <section
          key={section.id}
          className="rounded-lg border border-border bg-card p-4"
        >
          <h2 className="font-medium text-card-foreground text-sm">
            {section.title}
          </h2>
          {section.description && (
            <p className="mt-0.5 text-muted-foreground text-xs">
              {section.description}
            </p>
          )}

          {(section.perPerson ? participants : [{ id: "_", name: "" }]).map(
            (person) => {
              const editable = canEdit(section, person.id);
              return (
                <div
                  key={person.id}
                  className={
                    section.perPerson
                      ? "mt-3 rounded-md border border-border bg-surface-2 p-3"
                      : "mt-3"
                  }
                >
                  {section.perPerson && (
                    <p className="mb-2 flex items-baseline gap-2 font-medium text-foreground text-xs">
                      {person.name}
                      {!editable && (
                        <span className="font-normal text-[11px] text-muted-foreground">
                          {person.name.split(" ")[0]} fills this in — updates
                          live
                        </span>
                      )}
                    </p>
                  )}

                  {context[section.id]?.[person.id]?.length ? (
                    <div className="mb-2 rounded-md border border-(--obj-active)/30 bg-(--obj-active-bg)/40 p-2">
                      <p className="mb-1 text-[11px] text-muted-foreground">
                        From the board — confirm or adjust:
                      </p>
                      <ul className="space-y-0.5">
                        {context[section.id][person.id].map((c) => (
                          <li key={c.id} className="text-foreground text-xs">
                            <span className="font-mono text-muted-foreground">
                              EH-{c.displayNumber}
                            </span>{" "}
                            {c.title}{" "}
                            <span className="text-muted-foreground">
                              · {c.columnName}
                              {c.blockedReason ? ` — ${c.blockedReason}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="space-y-2.5">
                    {section.questions.map((q) => (
                      // biome-ignore lint/a11y/noLabelWithoutControl: the input/textarea is a conditional child of this label
                      <label key={q.id} className="block">
                        <span className="mb-1 block text-muted-foreground text-xs">
                          {q.label}
                        </span>
                        {q.kind === "short" ? (
                          <input
                            value={
                              answers[section.id]?.[person.id]?.[q.id] ?? ""
                            }
                            onChange={(e) =>
                              setAnswer(
                                section.id,
                                person.id,
                                q.id,
                                e.target.value,
                              )
                            }
                            onFocus={() => {
                              focusedField.current = `${section.id}:${person.id}:${q.id}`;
                            }}
                            onBlur={() => {
                              focusedField.current = null;
                            }}
                            placeholder={editable ? q.placeholder : undefined}
                            disabled={!editable}
                            className={`${inputCls} disabled:cursor-default disabled:opacity-75`}
                          />
                        ) : (
                          <textarea
                            value={
                              answers[section.id]?.[person.id]?.[q.id] ?? ""
                            }
                            onChange={(e) =>
                              setAnswer(
                                section.id,
                                person.id,
                                q.id,
                                e.target.value,
                              )
                            }
                            onFocus={() => {
                              focusedField.current = `${section.id}:${person.id}:${q.id}`;
                            }}
                            onBlur={() => {
                              focusedField.current = null;
                            }}
                            placeholder={editable ? q.placeholder : undefined}
                            rows={3}
                            disabled={!editable}
                            className={`${inputCls} disabled:cursor-default disabled:opacity-75`}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              );
            },
          )}
        </section>
      ))}

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-medium text-card-foreground text-sm">
          Additional notes
        </h2>
        <p className="mt-0.5 mb-2 text-muted-foreground text-xs">
          Anything the structure didn't catch — the AI reads this with the same
          weight as the answers above.
        </p>
        <textarea
          value={freeText}
          onChange={(e) => {
            setFreeText(e.target.value);
            markFreeTextEdited();
            broadcast("freeText", { value: e.target.value });
            scheduleSave();
          }}
          onFocus={() => {
            focusedField.current = "freeText";
          }}
          onBlur={() => {
            focusedField.current = null;
          }}
          rows={5}
          className={inputCls}
        />
      </section>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <footer className="fixed inset-x-0 bottom-0 border-border border-t bg-surface-1/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Discard this draft meeting?")) return;
              await deleteDraftMeeting({ id: meetingId });
              router.push("/meetings");
              router.refresh();
            }}
            className="rounded-md border border-border px-3 py-2 text-muted-foreground text-sm hover:bg-accent"
          >
            Discard draft
          </button>
          <p className="ml-auto text-muted-foreground text-xs max-sm:hidden">
            A draft can be resumed any time.
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit meeting"}
          </button>
        </div>
      </footer>
    </div>
  );
}
