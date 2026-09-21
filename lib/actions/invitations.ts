"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { invitation } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { ROLES } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

const createInvitationInput = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.toLowerCase()),
  role: z.enum(ROLES),
});

const INVITE_TTL_DAYS = 7;

export async function createInvitation(input: unknown) {
  const session = await requirePermission("user.invite");
  const { email, role } = createInvitationInput.parse(input);

  // Replace any open invitation for the same email instead of stacking them.
  await db
    .delete(invitation)
    .where(and(eq(invitation.email, email), isNull(invitation.acceptedAt)));

  const token = randomBytes(32).toString("base64url");
  const [created] = await db
    .insert(invitation)
    .values({
      id: randomUUID(),
      email,
      role,
      token,
      invitedBy: session.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning();

  revalidatePath("/admin/users");
  return {
    id: created.id,
    inviteUrl: `${serverEnv().BETTER_AUTH_URL}/invite/${token}`,
    expiresAt: created.expiresAt.toISOString(),
  };
}

export async function revokeInvitation(input: unknown) {
  await requirePermission("user.invite");
  const { id } = z.object({ id: z.string() }).parse(input);
  await db
    .delete(invitation)
    .where(and(eq(invitation.id, id), isNull(invitation.acceptedAt)));
  revalidatePath("/admin/users");
}
