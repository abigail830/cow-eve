import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./platform/infrastructure/persistence/database/schema.ts",
  out: "./platform/infrastructure/persistence/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
