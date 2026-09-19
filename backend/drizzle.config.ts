import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./platform/db/schema.ts",
  out: "./platform/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
