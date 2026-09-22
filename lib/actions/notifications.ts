"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { requirePermission } from "@/lib/session";

export async function getMyNotifications() {
  const session = await requirePermission("dashboard.view");
  const rows = await db
    .select()
    .from(notification)
    .where(eq(notification.userId, session.user.id))
    .orderBy(desc(notification.createdAt))
    .limit(30);
  return rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markAllNotificationsRead() {
  const session = await requirePermission("dashboard.view");
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.userId, session.user.id),
        isNull(notification.readAt),
      ),
    );
}
