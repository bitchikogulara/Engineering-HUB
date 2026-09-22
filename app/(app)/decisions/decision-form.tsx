"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createDecision } from "@/lib/actions/decisions";

export function DecisionForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-muted-foreground text-sm hover:bg-accent"
      >
        + Log a decision manually
      </button>
    );
  }

  return (
    <form
      className="space-y-2 rounded-lg border border-border bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.trim().length < 3) return;
        setPending(true);
        await createDecision({ text: text.trim(), context: context.trim() });
        setText("");
        setContext("");
        setOpen(false);
        setPending(false);
        router.refresh();
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='The decision, e.g. "Use MQTTS for all gate controllers"'
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="Context — why (optional)"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-1.5 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
        >
          Log decision
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-3 py-1.5 text-muted-foreground text-sm hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
