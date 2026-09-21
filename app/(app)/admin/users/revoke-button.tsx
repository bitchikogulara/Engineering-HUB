"use client";

import { useState } from "react";
import { revokeInvitation } from "@/lib/actions/invitations";

export function RevokeButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await revokeInvitation({ id });
      }}
      className="rounded-md border border-border px-2 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-destructive disabled:opacity-50"
    >
      Revoke
    </button>
  );
}
