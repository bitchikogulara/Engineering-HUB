import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

// Lazy singleton: nothing connects (and no env is read) at module import,
// so `next build` collects page data without credentials. postgres.js pools
// internally; `prepare: false` is required for Supabase's transaction pooler.
const globalForDb = globalThis as unknown as { dbInstance?: Db };

function getDb(): Db {
  if (!globalForDb.dbInstance) {
    const client = postgres(serverEnv().DATABASE_URL, {
      prepare: false,
      max: 5,
    });
    globalForDb.dbInstance = drizzle(client, { schema });
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
