"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requirePermission } from "@/lib/session";

export async function updateAccount(input: unknown) {
  const session = await requirePermission("dashboard.view");
  const data = z
    .object({
      name: z.string().trim().min(1).max(100),
      phone: z
        .string()
        .trim()
        .regex(
          /^\+?[0-9]{7,15}$/,
          "Use international format, e.g. +9955XXXXXXXX",
        )
        .nullable()
        .or(z.literal("").transform(() => null)),
    })
    .parse(input);
  await db
    .update(user)
    .set({ name: data.name, phone: data.phone, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));
  revalidatePath("/account");
  revalidatePath("/", "layout");
}
