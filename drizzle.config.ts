import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Not needed for `generate`; required for `migrate`.
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
