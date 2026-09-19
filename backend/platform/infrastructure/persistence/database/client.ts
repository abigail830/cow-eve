import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type PlatformDb = NeonHttpDatabase<typeof schema>;

let cached: PlatformDb | null = null;
let cachedUrl: string | null = null;

export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url && url.length > 0 ? url : null;
}

export function getDb(): PlatformDb | null {
  const url = getDatabaseUrl();
  if (!url) return null;
  if (cached && cachedUrl === url) return cached;
  cached = drizzle(neon(url), { schema });
  cachedUrl = url;
  return cached;
}

export function requireDb(): PlatformDb {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL is not configured");
  }
  return db;
}
