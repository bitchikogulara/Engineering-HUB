import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

// Lazy singleton: nothing connects (and no env is read) at module import,
// so `next build` collects page data without credentials.
// Driver note: node-postgres (pg), not postgres.js — postgres.js deadlocked
// under concurrent queries in the Next dev server (backend stuck in
// ClientRead, client never draining the socket).
const globalForDb = globalThis as unknown as { dbInstance?: Db };

function getDb(): Db {
  if (!globalForDb.dbInstance) {
    const pool = new Pool({
      connectionString: serverEnv().DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false }, // Supabase pooler TLS
    });
    globalForDb.dbInstance = drizzle(pool, { schema });
  }
  return globalForDb.dbInstance;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
