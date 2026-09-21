import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { invitation } from "@/db/schema";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [invite] = await db
    .select()
    .from(invitation)
    .where(eq(invitation.token, token));

  const invalid =
    !invite || invite.acceptedAt !== null || invite.expiresAt < new Date();

  if (invalid) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-2 font-medium text-card-foreground text-sm">
          Invitation not valid
        </h2>
        <p className="text-muted-foreground text-sm">
          This invitation link is invalid, expired, or already used. Ask an
          admin to send a new one.
        </p>
      </div>
    );
  }

  return <AcceptInviteForm email={invite.email} role={invite.role} />;
}
