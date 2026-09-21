import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { ScheduleRepository } from "../../../domain/schedule/schedule.repository";
import type {
  ClaimedScheduleTask,
  CreateScheduleInput,
  ScheduledTask,
  ScheduleStatus,
  UpdateScheduleInput,
} from "../../../domain/schedule/schedule.entity";
import {
  chats,
  getDb,
  getDatabaseUrl,
  scheduledTasks,
  type ScheduledTaskRow,
} from "../database";

function toDomain(row: ScheduledTaskRow): ScheduledTask {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    prompt: row.prompt,
    everyMinutes: row.everyMinutes,
    nextRunAt: row.nextRunAt,
    timezone: row.timezone,
    enabled: row.enabled,
    leaseToken: row.leaseToken,
    leaseExpiresAt: row.leaseExpiresAt,
    lastRunAt: row.lastRunAt,
    lastStatus: row.lastStatus as ScheduleStatus | null,
    lastError: row.lastError,
    lastChatId: row.lastChatId,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function computeNextRunAt(
  lastRunAt: Date,
  everyMinutes: number | null,
): Date | null {
  if (everyMinutes == null) return null;
  return new Date(lastRunAt.getTime() + everyMinutes * 60_000);
}

export class DrizzleScheduleRepository implements ScheduleRepository {
  async create(userId: string, input: CreateScheduleInput): Promise<ScheduledTask> {
    const db = getDb();
    if (!db) throw new Error("DATABASE_URL is not configured");

    const [row] = await db
      .insert(scheduledTasks)
      .values({
        userId,
        name: input.name?.trim() || null,
        prompt: input.prompt.trim(),
        everyMinutes: input.everyMinutes ?? null,
        nextRunAt: input.firstRunAt,
        timezone: input.timezone?.trim() || "Asia/Shanghai",
        enabled: true,
        lastStatus: "pending",
      })
      .returning();

    return toDomain(row);
  }

  async list(userId: string): Promise<ScheduledTask[]> {
    const db = getDb();
    if (!db) return [];

    const rows = await db.query.scheduledTasks.findMany({
      where: and(
        eq(scheduledTasks.userId, userId),
        isNull(scheduledTasks.deletedAt),
      ),
      orderBy: desc(scheduledTasks.updatedAt),
    });
    return rows.map(toDomain);
  }

  async getById(userId: string, id: string): Promise<ScheduledTask | null> {
    const db = getDb();
    if (!db) return null;

    const row = await db.query.scheduledTasks.findFirst({
      where: and(
        eq(scheduledTasks.id, id),
        eq(scheduledTasks.userId, userId),
        isNull(scheduledTasks.deletedAt),
      ),
    });
    return row ? toDomain(row) : null;
  }

  async update(
    userId: string,
    id: string,
    patch: UpdateScheduleInput,
  ): Promise<ScheduledTask | null> {
    const db = getDb();
    if (!db) return null;

    const values: Partial<typeof scheduledTasks.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.name !== undefined) values.name = patch.name?.trim() || null;
    if (patch.prompt !== undefined) values.prompt = patch.prompt.trim();
    if (patch.nextRunAt !== undefined) values.nextRunAt = patch.nextRunAt;
    if (patch.everyMinutes !== undefined) values.everyMinutes = patch.everyMinutes;
    if (patch.enabled !== undefined) values.enabled = patch.enabled;
    if (patch.timezone !== undefined) values.timezone = patch.timezone.trim();

    const [row] = await db
      .update(scheduledTasks)
      .set(values)
      .where(
        and(
          eq(scheduledTasks.id, id),
          eq(scheduledTasks.userId, userId),
          isNull(scheduledTasks.deletedAt),
        ),
      )
      .returning();

    return row ? toDomain(row) : null;
  }

  async softDelete(userId: string, id: string): Promise<boolean> {
    const db = getDb();
    if (!db) return false;

    const [row] = await db
      .update(scheduledTasks)
      .set({ deletedAt: new Date(), updatedAt: new Date(), enabled: false })
      .where(
        and(
          eq(scheduledTasks.id, id),
          eq(scheduledTasks.userId, userId),
          isNull(scheduledTasks.deletedAt),
        ),
      )
      .returning({ id: scheduledTasks.id });

    return Boolean(row);
  }

  async claimDue(input: {
    now: Date;
    limit: number;
    leaseForMs: number;
  }): Promise<ClaimedScheduleTask[]> {
    const db = getDb();
    if (!db) return [];

    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(input.now.getTime() + input.leaseForMs);

    const dueIds = await db
      .select({ id: scheduledTasks.id })
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.enabled, true),
          isNull(scheduledTasks.deletedAt),
          lte(scheduledTasks.nextRunAt, input.now),
          or(
            isNull(scheduledTasks.leaseExpiresAt),
            lte(scheduledTasks.leaseExpiresAt, input.now),
          ),
        ),
      )
      .orderBy(scheduledTasks.nextRunAt)
      .limit(input.limit)
      .for("update", { skipLocked: true });

    if (dueIds.length === 0) return [];

    const ids = dueIds.map((row) => row.id);
    const rows = await db
      .update(scheduledTasks)
      .set({
        leaseToken,
        leaseExpiresAt,
        lastStatus: "running",
        updatedAt: input.now,
      })
      .where(inArray(scheduledTasks.id, ids))
      .returning();

    return rows.map((row) => ({ ...toDomain(row), leaseToken }));
  }

  async complete(job: ClaimedScheduleTask): Promise<void> {
    const db = getDb();
    if (!db) return;

    const now = new Date();
    const nextRunAt = computeNextRunAt(now, job.everyMinutes);
    const isOneTime = job.everyMinutes == null;

    await db
      .update(scheduledTasks)
      .set({
        leaseToken: null,
        leaseExpiresAt: null,
        lastRunAt: now,
        lastStatus: "success",
        lastError: null,
        enabled: isOneTime ? false : job.enabled,
        nextRunAt: isOneTime ? job.nextRunAt : nextRunAt ?? job.nextRunAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(scheduledTasks.id, job.id),
          eq(scheduledTasks.leaseToken, job.leaseToken),
        ),
      );
  }

  async linkRunChat(input: {
    scheduleId: string;
    userId: string;
    eveSessionId: string;
  }): Promise<void> {
    const db = getDb();
    if (!db) return;

    const chat = await db.query.chats.findFirst({
      where: and(
        eq(chats.eveSessionId, input.eveSessionId),
        eq(chats.userId, input.userId),
      ),
    });
    if (!chat) return;

    await db
      .update(scheduledTasks)
      .set({ lastChatId: chat.id, updatedAt: new Date() })
      .where(
        and(
          eq(scheduledTasks.id, input.scheduleId),
          eq(scheduledTasks.userId, input.userId),
          isNull(scheduledTasks.deletedAt),
        ),
      );
  }

  async release(
    job: ClaimedScheduleTask,
    failure: { error: unknown; retryAt: Date },
  ): Promise<void> {
    const db = getDb();
    if (!db) return;

    const message =
      failure.error instanceof Error
        ? failure.error.message
        : String(failure.error);

    await db
      .update(scheduledTasks)
      .set({
        leaseToken: null,
        leaseExpiresAt: null,
        lastStatus: "failed",
        lastError: message.slice(0, 2000),
        nextRunAt: failure.retryAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledTasks.id, job.id),
          eq(scheduledTasks.leaseToken, job.leaseToken),
        ),
      );
  }
}

export const drizzleScheduleRepository = new DrizzleScheduleRepository();
