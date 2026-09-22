"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getMyNotifications,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";

type Item = Awaited<ReturnType<typeof getMyNotifications>>[number];

export function NotificationBell({ unread }: { unread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);

  async function toggle() {
    if (!open) {
      setOpen(true);
      const list = await getMyNotifications();
      setItems(list);
      if (list.some((i) => !i.read)) {
        await markAllNotificationsRead();
        router.refresh();
      }
    } else {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative rounded-md border border-border px-2.5 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
      >
        🔔
        {unread > 0 && (
          <span className="-top-1.5 -right-1.5 absolute flex size-4 items-center justify-center rounded-full bg-(--col-blocked) font-mono text-[9px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 max-h-96 w-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
            {items === null ? (
              <p className="p-4 text-muted-foreground text-xs">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-muted-foreground text-xs">
                Nothing yet — reminders and mentions land here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.href ?? "/dashboard"}
                      onClick={() => setOpen(false)}
                      className={`block px-3 py-2.5 hover:bg-accent/50 ${
                        n.read ? "opacity-60" : ""
                      }`}
                    >
                      <p className="text-popover-foreground text-sm">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-muted-foreground text-xs">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
