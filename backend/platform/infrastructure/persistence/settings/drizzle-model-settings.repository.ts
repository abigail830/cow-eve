import { eq } from "drizzle-orm";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ModelSettingsRepository } from "../../../domain/settings/model-settings.repository";
import {
  DEFAULT_MODEL_SETTINGS,
  normalizeModelSettings,
  type ModelSettings,
} from "../../../domain/settings/model-settings.entity";
import {
  getDb,
  getDatabaseUrl,
  platformSettings,
} from "../database";

const MODEL_SETTINGS_ID = "model";

let memoryCache: ModelSettings | null = null;

function wrapDbError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("platform_settings") &&
    (msg.includes("does not exist") ||
      msg.includes("relation") ||
      msg.includes("Failed query"))
  ) {
    return new Error(
      "Model settings table is missing in Neon. Run `npm run db:migrate` in backend/ (with DATABASE_URL set), then retry.",
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

function findBackendRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(dir, "package.json"), "utf8"),
      ) as { name?: string };
      if (pkg.name === "cow-eve-backend") return dir;
    } catch {
      // continue
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function settingsFilePath(): string {
  if (process.env.PLATFORM_DATA_DIR) {
    return join(process.env.PLATFORM_DATA_DIR, "model-settings.json");
  }
  return join(findBackendRoot(), "platform", "data", "model-settings.json");
}

function loadFromFile(): ModelSettings {
  const path = settingsFilePath();
  if (!existsSync(path)) return { ...DEFAULT_MODEL_SETTINGS };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<ModelSettings>;
    return normalizeModelSettings(raw);
  } catch {
    return { ...DEFAULT_MODEL_SETTINGS };
  }
}

function saveToFile(next: ModelSettings): ModelSettings {
  const path = settingsFilePath();
  mkdirSync(dirname(path), { recursive: true });
  const toWrite: ModelSettings = {
    ...next,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(path, `${JSON.stringify(toWrite, null, 2)}\n`, "utf8");
  return toWrite;
}

export class DrizzleModelSettingsRepository implements ModelSettingsRepository {
  async load(): Promise<ModelSettings> {
    if (memoryCache) return memoryCache;

    const db = getDb();
    if (db) {
      try {
        const row = await db.query.platformSettings.findFirst({
          where: eq(platformSettings.id, MODEL_SETTINGS_ID),
        });
        memoryCache = normalizeModelSettings(
          row?.payload as Partial<ModelSettings> | undefined,
        );
        return memoryCache;
      } catch (err) {
        throw wrapDbError(err);
      }
    }

    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      if (!getDatabaseUrl()) {
        console.warn(
          "[model-store] DATABASE_URL missing in production; using defaults (cannot persist)",
        );
      }
      memoryCache = { ...DEFAULT_MODEL_SETTINGS };
      return memoryCache;
    }

    memoryCache = loadFromFile();
    return memoryCache;
  }

  async save(next: ModelSettings): Promise<ModelSettings> {
    const toWrite: ModelSettings = {
      ...next,
      updatedAt: new Date().toISOString(),
    };

    const db = getDb();
    if (db) {
      try {
        await db
          .insert(platformSettings)
          .values({
            id: MODEL_SETTINGS_ID,
            payload: toWrite,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: platformSettings.id,
            set: {
              payload: toWrite,
              updatedAt: new Date(),
            },
          });
        memoryCache = toWrite;
        return toWrite;
      } catch (err) {
        throw wrapDbError(err);
      }
    }

    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      throw new Error(
        "DATABASE_URL is required to save model settings on Vercel (filesystem is read-only)",
      );
    }

    const saved = saveToFile(toWrite);
    memoryCache = saved;
    return saved;
  }
}

export const drizzleModelSettingsRepository =
  new DrizzleModelSettingsRepository();
