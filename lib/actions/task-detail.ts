"use server";

import { z } from "zod";
import { getTaskActivity, getTaskComments } from "@/lib/queries/board";
import { requirePermission } from "@/lib/session";

/** Read action for the task sheet: activity trail + comment thread. */
export async function getTaskDetail(input: unknown) {
  await requirePermission("dashboard.view"); // any signed-in role may read
  const { taskId } = z.object({ taskId: z.string().uuid() }).parse(input);
  const [activity, comments] = await Promise.all([
    getTaskActivity(taskId),
    getTaskComments(taskId),
  ]);
  return {
    activity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      actorType: a.actorType,
      actorName: a.actorName ?? "AI",
      diff: a.diff as Record<string, unknown> | null,
      createdAt: a.createdAt.toISOString(),
    })),
    comments: comments.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      body: c.body,
      authorName: c.authorName,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}
