"use client";

import { useState } from "react";

/** FR-4: a move into a blocked column must name the blocker. */
export function BlockedReasonDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-popover p-4 shadow-lg">
        <h3 className="mb-1 font-medium text-popover-foreground text-sm">
          What is blocking this task?
        </h3>
        <p className="mb-3 text-muted-foreground text-xs">
          The reason feeds the daily sync automatically.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) onConfirm(reason.trim());
          }}
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: the dialog exists to collect this one field
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. waiting on replacement transceiver, ETA Friday"
            className="mb-3 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-3 py-1.5 text-muted-foreground text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="rounded-md bg-(--col-blocked) px-3 py-1.5 font-medium text-sm text-white disabled:opacity-50"
            >
              Move to Blocked
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
