import { eq } from "drizzle-orm";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  CreateUserRecord,
  PlatformUserRecord,
  UserRepository,
} from "../../../domain/auth/user.repository";
import { PRESET_USERS } from "../../../domain/auth/user.entity";
import {
  getDb,
  getDatabaseUrl,
  platformUsers,
} from "../database";

type StoredUser = {
  email: string;
  displayName: string;
  passwordHash: string;
  lastLoginAt: string | null;
  createdAt: string;
};

let memoryCache: PlatformUserRecord[] | null = null;

function wrapDbError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("platform_users") &&
    (msg.includes("does not exist") ||
      msg.includes("relation") ||
      msg.includes("Failed query"))
  ) {
    return new Error(
      "Users table is missing in Neon. Run `npm run db:migrate` in backend/ (with DATABASE_URL set), then retry.",
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

function usersFilePath(): string {
  if (process.env.PLATFORM_DATA_DIR) {
    return join(process.env.PLATFORM_DATA_DIR, "users.json");
  }
  return join(findBackendRoot(), "platform", "data", "users.json");
}

function toRecord(row: StoredUser): PlatformUserRecord {
  return {
    email: row.email,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
    createdAt: new Date(row.createdAt),
  };
}

function toStored(user: PlatformUserRecord): StoredUser {
  return {
    email: user.email,
    displayName: user.displayName,
    passwordHash: user.passwordHash,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function seedUsers(): PlatformUserRecord[] {
  const now = new Date();
  return PRESET_USERS.map((user) => ({
    ...user,
    lastLoginAt: null,
    createdAt: now,
  }));
}

function loadFromFile(): PlatformUserRecord[] {
  const path = usersFilePath();
  if (!existsSync(path)) return seedUsers();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as StoredUser[];
    if (!Array.isArray(raw) || raw.length === 0) return seedUsers();
    return raw.map(toRecord);
  } catch {
    return seedUsers();
  }
}

function saveToFile(users: PlatformUserRecord[]): PlatformUserRecord[] {
  const path = usersFilePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(users.map(toStored), null, 2)}\n`,
    "utf8",
  );
  return users;
}

function rowToRecord(row: {
  email: string;
  displayName: string;
  passwordHash: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}): PlatformUserRecord {
  return {
    email: row.email,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class DrizzleUserRepository implements UserRepository {
  private async ensureSeeded(db: NonNullable<ReturnType<typeof getDb>>) {
    const rows = await db.select().from(platformUsers);
    if (rows.length > 0) return;

    const seeded = seedUsers();
    for (const user of seeded) {
      await db.insert(platformUsers).values({
        email: user.email,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      });
    }
  }

  private async loadAll(): Promise<PlatformUserRecord[]> {
    if (memoryCache) return memoryCache;

    const db = getDb();
    if (db) {
      try {
        await this.ensureSeeded(db);
        const rows = await db.select().from(platformUsers);
        memoryCache = rows.map(rowToRecord);
        return memoryCache;
      } catch (err) {
        throw wrapDbError(err);
      }
    }

    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      if (!getDatabaseUrl()) {
        console.warn(
          "[user-store] DATABASE_URL missing in production; using preset users (cannot persist)",
        );
      }
      memoryCache = seedUsers();
      return memoryCache;
    }

    memoryCache = loadFromFile();
    return memoryCache;
  }

  async list(): Promise<PlatformUserRecord[]> {
    const users = await this.loadAll();
    return [...users].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async findByEmail(email: string): Promise<PlatformUserRecord | undefined> {
    const normalized = normalizeEmail(email);
    const users = await this.loadAll();
    return users.find((user) => user.email.toLowerCase() === normalized);
  }

  async create(user: CreateUserRecord): Promise<PlatformUserRecord> {
    const email = normalizeEmail(user.email);
    const next: PlatformUserRecord = {
      email,
      displayName: user.displayName.trim() || email,
      passwordHash: user.passwordHash,
      lastLoginAt: null,
      createdAt: new Date(),
    };

    const db = getDb();
    if (db) {
      try {
        await db.insert(platformUsers).values({
          email: next.email,
          displayName: next.displayName,
          passwordHash: next.passwordHash,
          lastLoginAt: next.lastLoginAt,
          createdAt: next.createdAt,
        });
        memoryCache = null;
        return next;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("duplicate") || msg.includes("unique")) {
          throw new Error("A user with this email already exists");
        }
        throw wrapDbError(err);
      }
    }

    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      throw new Error(
        "DATABASE_URL is required to manage users on Vercel (filesystem is read-only)",
      );
    }

    const users = await this.loadAll();
    if (users.some((item) => item.email.toLowerCase() === email)) {
      throw new Error("A user with this email already exists");
    }
    const saved = saveToFile([...users, next]);
    memoryCache = saved;
    return next;
  }

  async delete(email: string): Promise<boolean> {
    const normalized = normalizeEmail(email);
    const db = getDb();
    if (db) {
      try {
        const deleted = await db
          .delete(platformUsers)
          .where(eq(platformUsers.email, normalized))
          .returning({ email: platformUsers.email });
        memoryCache = null;
        return deleted.length > 0;
      } catch (err) {
        throw wrapDbError(err);
      }
    }

    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      throw new Error(
        "DATABASE_URL is required to manage users on Vercel (filesystem is read-only)",
      );
    }

    const users = await this.loadAll();
    const next = users.filter((user) => user.email.toLowerCase() !== normalized);
    if (next.length === users.length) return false;
    memoryCache = saveToFile(next);
    return true;
  }

  async recordLogin(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    const now = new Date();

    const db = getDb();
    if (db) {
      try {
        await db
          .update(platformUsers)
          .set({ lastLoginAt: now })
          .where(eq(platformUsers.email, normalized));
        memoryCache = null;
        return;
      } catch (err) {
        throw wrapDbError(err);
      }
    }

    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      return;
    }

    const users = await this.loadAll();
    const idx = users.findIndex(
      (user) => user.email.toLowerCase() === normalized,
    );
    if (idx < 0) return;
    const next = [...users];
    next[idx] = { ...next[idx]!, lastLoginAt: now };
    memoryCache = saveToFile(next);
  }
}

export const drizzleUserRepository = new DrizzleUserRepository();
