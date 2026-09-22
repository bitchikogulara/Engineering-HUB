import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { AccountForm } from "./account-form";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireSession();
  const [me] = await db
    .select({
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(eq(user.id, session.user.id));

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-semibold text-foreground text-xl">Account</h1>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-4 text-muted-foreground text-xs">
          <span className="font-mono">{me.email}</span> ·{" "}
          <span className="capitalize">{me.role}</span>
        </p>
        <AccountForm name={me.name} phone={me.phone} />
      </div>
    </div>
  );
}
