import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notification, user } from "@/db/schema";
import { serverEnv } from "@/lib/env";

// Channel-agnostic dispatcher (ADR-006): every event lands in the in-app feed;
// WhatsApp mirrors it when the Meta Cloud API is configured AND the user has a
// phone number. A notification failure must never break the calling action.

export type NotifyEvent = {
  kind: "mention" | "reminder" | "digest" | "proposal_ready";
  title: string;
  body?: string;
  href?: string; // app-relative deep link, e.g. "/meetings/abc"
};

export async function notifyUsers(
  userIds: string[],
  event: NotifyEvent,
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await db.insert(notification).values(
      userIds.map((userId) => ({
        userId,
        kind: event.kind,
        title: event.title,
        body: event.body ?? null,
        href: event.href ?? null,
      })),
    );
  } catch (err) {
    console.error("in-app notification failed", err);
  }
  await sendWhatsApp(userIds, event).catch((err) =>
    console.error("whatsapp notification failed", err),
  );
}

async function sendWhatsApp(
  userIds: string[],
  event: NotifyEvent,
): Promise<void> {
  const env = serverEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return;
  const recipients = await db
    .select({ id: user.id, phone: user.phone })
    .from(user)
    .where(inArray(user.id, userIds));
  const base = env.APP_URL ?? env.BETTER_AUTH_URL;
  const text = [
    event.title,
    event.body,
    event.href ? `${base}${event.href}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await Promise.all(
    recipients
      .filter((r) => r.phone)
      .map((r) =>
        fetch(
          `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: r.phone,
              type: "text",
              text: { body: text },
            }),
          },
        ).then(async (res) => {
          if (!res.ok) {
            console.error("whatsapp send failed", r.id, await res.text());
          }
        }),
      ),
  );
}

/** Active member/admin ids — the reminder audience. */
export async function activeTeamIds(): Promise<string[]> {
  const rows = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.active, true));
  return rows.filter((r) => r.role !== "viewer").map((r) => r.id);
}
