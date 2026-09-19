import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is required to run migrations");
  process.exit(1);
}

const migrationsFolder = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

const sql = neon(url);
const db = drizzle(sql);

await migrate(db, { migrationsFolder });
console.log("Migrations applied successfully");
