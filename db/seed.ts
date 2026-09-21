import "dotenv/config";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Idempotent seed: only inserts when the target table is empty, so running it
// on an existing installation never duplicates or overwrites admin edits.

const DEFAULT_COLUMNS = [
  { name: "Backlog", position: 1 },
  { name: "This week", position: 2 },
  { name: "In progress", position: 3, wipHint: 3 },
  { name: "Blocked", position: 4, isBlocked: true },
  { name: "Review", position: 5 },
  { name: "Done", position: 6, isDone: true },
];

const DEFAULT_TASK_TYPES = [
  { name: "Internal", color: "internal", icon: "wrench", position: 1 },
  {
    name: "Service request",
    color: "service",
    icon: "arrow-down-left",
    isExternal: true,
    position: 2,
  },
  {
    name: "Print job",
    color: "print",
    icon: "printer",
    isExternal: true,
    position: 3,
  },
  {
    name: "Repair",
    color: "service",
    icon: "hammer",
    isExternal: true,
    position: 4,
  },
  { name: "Admin", color: "internal", icon: "clipboard-list", position: 5 },
];

const DEFAULT_PROJECTS = [
  { name: "FaceGate", color: 6 },
  { name: "Diagnostics app", color: 5 },
  { name: "Tender monitoring", color: 2 },
  { name: "Parking systems", color: 7 },
];

async function main() {
  const client = postgres(process.env.DATABASE_URL as string, {
    prepare: false,
    max: 1,
  });
  const db = drizzle(client, { schema });

  const [{ value: columns }] = await db
    .select({ value: count() })
    .from(schema.boardColumn);
  if (columns === 0) {
    await db.insert(schema.boardColumn).values(DEFAULT_COLUMNS);
    console.log("seeded board columns");
  }

  const [{ value: types }] = await db
    .select({ value: count() })
    .from(schema.taskType);
  if (types === 0) {
    await db.insert(schema.taskType).values(DEFAULT_TASK_TYPES);
    console.log("seeded task types");
  }

  const [{ value: projects }] = await db
    .select({ value: count() })
    .from(schema.project);
  if (projects === 0) {
    await db.insert(schema.project).values(DEFAULT_PROJECTS);
    console.log("seeded projects");
  }

  // Meeting templates seed arrives with phase 2.
  await client.end();
  console.log("seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
