"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateAccount } from "@/lib/actions/account";

export function AccountForm({
  name: initialName,
  phone: initialPhone,
}: {
  name: string;
  phone: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("saving");
        setError(null);
        try {
          await updateAccount({ name, phone: phone || null });
          setState("saved");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Save failed");
          setState("idle");
        }
      }}
    >
      <label className="block">
        <span className="mb-1 block text-muted-foreground text-xs">
          Display name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-muted-foreground text-xs">
          WhatsApp number (for reminders — optional)
        </span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+9955XXXXXXXX"
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <button
        type="submit"
        disabled={state === "saving"}
        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
      >
        {state === "saving"
          ? "Saving…"
          : state === "saved"
            ? "Saved ✓"
            : "Save"}
      </button>
    </form>
  );
}
