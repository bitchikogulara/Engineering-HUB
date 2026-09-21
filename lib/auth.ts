import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { serverEnv } from "@/lib/env";

/**
 * Invite-only auth (FR-31). User creation is blocked unless:
 *  - no users exist yet → the first account becomes admin (bootstrap), or
 *  - a live, unexpired invitation matches the email → role copied from it.
 * Applies to both credentials sign-up and GitHub OAuth sign-in.
 */
async function resolveInvitedRole(email: string): Promise<string> {
  const [{ value: userCount }] = await db
    .select({ value: count() })
    .from(schema.user);
  if (userCount === 0) return "admin";

  const invites = await db
    .select()
    .from(schema.invitation)
    .where(eq(schema.invitation.email, email.toLowerCase()));
  const live = invites.find((i) => !i.acceptedAt && i.expiresAt > new Date());
  if (!live) {
    throw new APIError("FORBIDDEN", {
      message:
        "Engineering Hub is invite-only. Ask an admin for an invitation.",
    });
  }
  return live.role;
}

async function markInvitationAccepted(email: string) {
  await db
    .update(schema.invitation)
    .set({ acceptedAt: new Date() })
    .where(eq(schema.invitation.email, email.toLowerCase()));
}

function githubProvider() {
  const env = serverEnv();
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return {};
  return {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  };
}

function createAuth() {
  return betterAuth({
    baseURL: serverEnv().BETTER_AUTH_URL,
    secret: serverEnv().BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
    },
    socialProviders: githubProvider(),
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "member", input: false },
        active: { type: "boolean", defaultValue: true, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => {
            const role = await resolveInvitedRole(u.email);
            return { data: { ...u, role, active: true } };
          },
          after: async (u) => {
            await markInvitationAccepted(u.email);
          },
        },
      },
      session: {
        create: {
          before: async (s) => {
            // Deactivated users cannot start new sessions.
            const [u] = await db
              .select({ active: schema.user.active })
              .from(schema.user)
              .where(eq(schema.user.id, s.userId));
            if (!u?.active) {
              throw new APIError("FORBIDDEN", {
                message: "Account is deactivated.",
              });
            }
            return { data: s };
          },
        },
      },
    },
    plugins: [nextCookies()], // must stay last
  });
}

type Auth = ReturnType<typeof createAuth>;

// Lazy singleton: env is only read on first use at request time, never during
// `next build` page-data collection (same pattern as db/index.ts).
const globalForAuth = globalThis as unknown as { authInstance?: Auth };

function getAuth(): Auth {
  if (!globalForAuth.authInstance) {
    globalForAuth.authInstance = createAuth();
  }
  return globalForAuth.authInstance;
}

export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const instance = getAuth();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export type Session = Auth["$Infer"]["Session"];
