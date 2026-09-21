import { count } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { user } from "@/db/schema";
import { BootstrapAdminForm } from "./bootstrap-admin-form";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const [{ value: userCount }] = await db.select({ value: count() }).from(user);

  if (userCount === 0) {
    // Fresh install: the first account becomes admin (see lib/auth.ts).
    return <BootstrapAdminForm />;
  }

  return <SignInForm githubEnabled={Boolean(process.env.GITHUB_CLIENT_ID)} />;
}
