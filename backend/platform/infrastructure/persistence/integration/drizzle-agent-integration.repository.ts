import { and, eq } from "drizzle-orm";
import { agentIntegrations } from "../database/schema.js";
import { getDb, requireDb } from "../database/client.js";

export type AgentIntegrationRow = {
  userId: string;
  agentId: string;
  integrationId: string;
  secretsEncrypted: Record<string, string>;
  config: Record<string, unknown>;
  updatedAt: Date;
};

function wrapDbError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("agent_integrations") &&
    (msg.includes("does not exist") ||
      msg.includes("relation") ||
      msg.includes("Failed query"))
  ) {
    return new Error(
      "Agent integrations storage is not ready. Run `npm run db:migrate` in backend/.",
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

function rowFromDb(row: typeof agentIntegrations.$inferSelect): AgentIntegrationRow {
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
    agentId: row.agentId,
    integrationId: row.integrationId,
    secretsEncrypted: secrets,
    config,
    updatedAt: row.updatedAt,
  };
}

export const drizzleAgentIntegrationRepository = {
  async listForUserAgent(
    userId: string,
    agentId: string,
  ): Promise<AgentIntegrationRow[]> {
    const db = getDb();
    if (!db) return [];
    try {
      const rows = await db
        .select()
        .from(agentIntegrations)
        .where(
          and(
            eq(agentIntegrations.userId, userId),
            eq(agentIntegrations.agentId, agentId),
          ),
        );
      return rows.map(rowFromDb);
    } catch (err) {
      throw wrapDbError(err);
    }
  },

  async getForUserAgent(
    userId: string,
    agentId: string,
    integrationId: string,
  ): Promise<AgentIntegrationRow | null> {
    const db = getDb();
    if (!db) return null;
    try {
      const rows = await db
        .select()
        .from(agentIntegrations)
        .where(
          and(
            eq(agentIntegrations.userId, userId),
            eq(agentIntegrations.agentId, agentId),
            eq(agentIntegrations.integrationId, integrationId),
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
    agentId: string;
    integrationId: string;
    secretsEncrypted: Record<string, string>;
    config: Record<string, unknown>;
  }): Promise<AgentIntegrationRow> {
    const db = requireDb();
    const now = new Date();
    try {
      await db
        .insert(agentIntegrations)
        .values({
          userId: input.userId,
          agentId: input.agentId,
          integrationId: input.integrationId,
          secretsEncrypted: input.secretsEncrypted,
          config: input.config,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            agentIntegrations.userId,
            agentIntegrations.agentId,
            agentIntegrations.integrationId,
          ],
          set: {
            secretsEncrypted: input.secretsEncrypted,
            config: input.config,
            updatedAt: now,
          },
        });
    } catch (err) {
      throw wrapDbError(err);
    }
    const saved = await this.getForUserAgent(
      input.userId,
      input.agentId,
      input.integrationId,
    );
    if (!saved) throw new Error("Failed to save agent integration.");
    return saved;
  },
};
