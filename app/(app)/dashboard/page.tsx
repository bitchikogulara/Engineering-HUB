import type { Metadata } from "next";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user } = await requireSession();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-semibold text-foreground text-xl">
        Welcome, {user.name.split(" ")[0]}
      </h1>
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-card-foreground text-sm">
          Phase 0 is live: authentication, invitations, and the app shell. The
          task board arrives in phase 1 — this dashboard will fill up as modules
          ship.
        </p>
      </div>
    </div>
  );
}
