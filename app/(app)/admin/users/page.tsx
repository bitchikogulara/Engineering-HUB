import { desc, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { invitation, user } from "@/db/schema";
import { hasPermission } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { InviteForm } from "./invite-form";
import { RevokeButton } from "./revoke-button";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "user.manage")) redirect("/dashboard");

  const users = await db.select().from(user).orderBy(desc(user.createdAt));
  const openInvites = await db
    .select()
    .from(invitation)
    .where(isNull(invitation.acceptedAt))
    .orderBy(desc(invitation.createdAt));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-semibold text-foreground text-xl">Users</h1>

      <section className="rounded-lg border border-border bg-card">
        <h2 className="border-border border-b px-5 py-3 font-medium text-card-foreground text-sm">
          Team ({users.length})
        </h2>
        <ul>
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 border-border border-b px-5 py-3 last:border-0"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-secondary font-medium text-secondary-foreground text-xs">
                {u.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground text-sm">{u.name}</p>
                <p className="truncate font-mono text-muted-foreground text-xs">
                  {u.email}
                </p>
              </div>
              <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground text-xs capitalize">
                {u.role}
              </span>
              {!u.active && (
                <span className="rounded-full bg-(--badge-overdue-bg) px-2 py-0.5 text-(--badge-overdue-fg) text-xs">
                  deactivated
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 font-medium text-card-foreground text-sm">
          Invite someone
        </h2>
        <InviteForm />
      </section>

      {openInvites.length > 0 && (
        <section className="rounded-lg border border-border bg-card">
          <h2 className="border-border border-b px-5 py-3 font-medium text-card-foreground text-sm">
            Open invitations
          </h2>
          <ul>
            {openInvites.map((i) => {
              const expired = i.expiresAt < new Date();
              return (
                <li
                  key={i.id}
                  className="flex items-center gap-3 border-border border-b px-5 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-foreground text-sm">
                      {i.email}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      as {i.role} ·{" "}
                      {expired
                        ? "expired"
                        : `expires ${i.expiresAt.toLocaleDateString()}`}
                    </p>
                  </div>
                  {expired && (
                    <span className="rounded-full bg-(--badge-stale-bg) px-2 py-0.5 text-(--badge-stale-fg) text-xs">
                      expired
                    </span>
                  )}
                  <RevokeButton id={i.id} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
