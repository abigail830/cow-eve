import { and, eq } from "drizzle-orm";
import { userIntegrations } from "../database/schema.js";
import { getDb, requireDb } from "../database/client.js";

export type UserIntegrationRow = {
  userId: string;
  integrationId: string;
  secretsEncrypted: Record<string, string>;
  config: Record<string, unknown>;
  updatedAt: Date;
};

function wrapDbError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("user_integrations") &&
    (msg.includes("does not exist") ||
      msg.includes("relation") ||
      msg.includes("Failed query"))
  ) {
    return new Error(
      "Integrations storage is not ready. Run `npm run db:migrate` in backend/ (with DATABASE_URL set), then retry.",
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

function rowFromDb(row: typeof userIntegrations.$inferSelect): UserIntegrationRow {
  const secrets =
    row.secretsEncrypted && typeof row.secretsEncrypted === "object"
      ? (row.secretsEncrypted as Record<string, string>)
      : {};
  const config =
    row.config && typeof row.config === "object"
      ? (row.config as Record<string, unknown>)
      : {};
  return {
    userId: row.userId,
    integrationId: row.integrationId,
    secretsEncrypted: secrets,
    config,
    updatedAt: row.updatedAt,
  };
}

export const drizzleUserIntegrationRepository = {
  async listForUser(userId: string): Promise<UserIntegrationRow[]> {
    const db = getDb();
    if (!db) return [];
    try {
      const rows = await db
        .select()
        .from(userIntegrations)
        .where(eq(userIntegrations.userId, userId));
      return rows.map(rowFromDb);
    } catch (err) {
      throw wrapDbError(err);
    }
  },

  async getForUser(
    userId: string,
    integrationId: string,
  ): Promise<UserIntegrationRow | null> {
    const db = getDb();
    if (!db) return null;
    try {
      const rows = await db
        .select()
        .from(userIntegrations)
        .where(
          and(
            eq(userIntegrations.userId, userId),
            eq(userIntegrations.integrationId, integrationId),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? rowFromDb(row) : null;
    } catch (err) {
      throw wrapDbError(err);
    }
  },

  async upsert(input: {
    userId: string;
    integrationId: string;
    secretsEncrypted: Record<string, string>;
    config: Record<string, unknown>;
  }): Promise<UserIntegrationRow> {
    const db = requireDb();
    const now = new Date();
    try {
      await db
        .insert(userIntegrations)
        .values({
          userId: input.userId,
          integrationId: input.integrationId,
          secretsEncrypted: input.secretsEncrypted,
          config: input.config,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [userIntegrations.userId, userIntegrations.integrationId],
          set: {
            secretsEncrypted: input.secretsEncrypted,
            config: input.config,
            updatedAt: now,
          },
        });
    } catch (err) {
      throw wrapDbError(err);
    }
    const saved = await this.getForUser(input.userId, input.integrationId);
    if (!saved) throw new Error("Failed to save integration.");
    return saved;
  },
};
