import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { assertPermission, type Permission } from "@/lib/permissions";

export async function getSession() {
  // headers() must resolve BEFORE auth is touched: it marks the route dynamic,
  // which keeps env/DB access out of build-time prerendering.
  const requestHeaders = await headers();
  return auth.api.getSession({ headers: requestHeaders });
}

/** For pages/layouts: redirects to sign-in when unauthenticated. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** For Server Actions / Route Handlers: throws on missing auth or permission. */
export async function requirePermission(permission: Permission) {
  const session = await getSession();
  if (!session) throw new Error("Unauthenticated");
  assertPermission(session.user.role, permission);
  return session;
}
