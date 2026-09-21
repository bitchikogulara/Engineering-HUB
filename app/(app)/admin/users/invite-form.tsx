"use client";

import { useState } from "react";
import { createInvitation } from "@/lib/actions/invitations";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setInviteUrl(null);
    setCopied(false);
    try {
      const result = await createInvitation({ email, role });
      setInviteUrl(result.inviteUrl);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invitation failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
        <label className="min-w-52 flex-1">
          <span className="mb-1 block text-muted-foreground text-xs">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label>
          <span className="mb-1 block text-muted-foreground text-xs">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create invite"}
        </button>
      </form>
      {error && <p className="text-destructive text-xs">{error}</p>}
      {inviteUrl && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 p-2">
          <code className="min-w-0 flex-1 truncate font-mono text-foreground text-xs">
            {inviteUrl}
          </code>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(inviteUrl);
              setCopied(true);
            }}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-muted-foreground text-xs hover:bg-accent"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
