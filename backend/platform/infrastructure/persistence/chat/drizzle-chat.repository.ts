import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { ChatRepository } from "../../../domain/chat/chat.repository";
import type { Chat, ChatWithEvents } from "../../../domain/chat/chat.entity";
import {
  titleFromMessage,
  type PersistableEvent,
} from "../../../domain/chat/stream-event.types";
import {
  getDb,
  getDatabaseUrl,
  chats,
  chatEvents,
  chatSessionBindings,
  chatWorkspaceFileRefs,
  scheduledTasks,
  workspaceFiles,
  type ChatRow,
} from "../database";

function toDomainChat(row: ChatRow): Chat {
  return {
    id: row.id,
    userId: row.userId,
    agentId: row.agentId,
    eveSessionId: row.eveSessionId,
    eveStreamIndex: row.eveStreamIndex,
    title: row.title,
    titleSource: row.titleSource ?? null,
    titleGeneratedAt: row.titleGeneratedAt ?? null,
    deletedAt: row.deletedAt,
    projectId: row.projectId ?? null,
    scheduledTaskId: row.scheduledTaskId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleChatRepository implements ChatRepository {
  async ensureChat(input: {
    userId: string;
    agentId: string;
    eveSessionId: string;
  }): Promise<Chat | null> {
    const db = getDb();
    if (!db) {
      if (!getDatabaseUrl()) {
        console.warn("[persist-chat] DATABASE_URL missing; skip upsert");
      }
      return null;
    }

    const existing = await db.query.chats.findFirst({
      where: eq(chats.eveSessionId, input.eveSessionId),
    });
    if (existing) {
      if (existing.deletedAt) return toDomainChat(existing);
      await db
        .update(chats)
        .set({ updatedAt: new Date() })
        .where(eq(chats.id, existing.id));
      return toDomainChat(existing);
    }

    const binding = await db.query.chatSessionBindings.findFirst({
      where: eq(chatSessionBindings.eveSessionId, input.eveSessionId),
    });
    const projectId =
      binding &&
      binding.userId === input.userId &&
      binding.agentId === input.agentId
        ? binding.projectId ?? null
        : null;

    const [row] = await db
      .insert(chats)
      .values({
        userId: input.userId,
        agentId: input.agentId,
        eveSessionId: input.eveSessionId,
        projectId,
      })
      .onConflictDoNothing({ target: chats.eveSessionId })
      .returning();

    if (row) return toDomainChat(row);

    const fallback = await db.query.chats.findFirst({
      where: eq(chats.eveSessionId, input.eveSessionId),
    });
    return fallback ? toDomainChat(fallback) : null;
  }

  async persistStreamEvent(input: {
    userId: string;
    agentId: string;
    eveSessionId: string;
    event: PersistableEvent;
  }): Promise<void> {
    if (!getDb()) {
      if (!getDatabaseUrl()) {
        console.warn("[persist-chat] DATABASE_URL missing; skip event");
      }
      return;
    }
    const chat = await this.ensureChat({
      userId: input.userId,
      agentId: input.agentId,
      eveSessionId: input.eveSessionId,
    });
    if (!chat) return;

    const db = getDb()!;
    const emittedAt =
      input.event.meta.at instanceof Date
        ? input.event.meta.at
        : new Date(input.event.meta.at);

    const [inserted] = await db
      .insert(chatEvents)
      .values({
        id: input.event.meta.id,
        chatId: chat.id,
        type: input.event.type,
        payload: {
          type: input.event.type,
          data: input.event.data ?? null,
          meta: input.event.meta,
        },
        emittedAt,
      })
      .onConflictDoNothing({ target: chatEvents.id })
      .returning({ id: chatEvents.id });

    if (inserted) {
      await db
        .update(chats)
        .set({
          eveStreamIndex: sql`${chats.eveStreamIndex} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(chats.id, chat.id));
    }

    if (input.event.type === "message.received" && !chat.title) {
      const data = input.event.data as {
        message?: string;
        kind?: string;
      } | null;
      if (data?.kind === "execution.background_task") return;
      const message = typeof data?.message === "string" ? data.message : "";
      if (!message.trim()) return;
      await db
        .update(chats)
        .set({ title: titleFromMessage(message), updatedAt: new Date() })
        .where(and(eq(chats.id, chat.id), isNull(chats.title)));
    } else if (!inserted) {
      await db
        .update(chats)
        .set({ updatedAt: new Date() })
        .where(eq(chats.id, chat.id));
    }
  }

  async listChats(input: {
    userId: string;
    agentId: string;
    scope?: "generic" | "project" | "schedule";
    projectId?: string;
    scheduleId?: string;
  }): Promise<Chat[]> {
    const db = requireDb();
    const conditions = [
      eq(chats.userId, input.userId),
      eq(chats.agentId, input.agentId),
      isNull(chats.deletedAt),
    ];
    if (input.scope === "generic") {
      conditions.push(isNull(chats.projectId));
      conditions.push(isNull(chats.scheduledTaskId));
    } else if (input.scope === "project") {
      if (!input.projectId?.trim()) {
        return [];
      }
      conditions.push(eq(chats.projectId, input.projectId.trim()));
      conditions.push(isNull(chats.scheduledTaskId));
    } else if (input.scope === "schedule") {
      const scheduleId = input.scheduleId?.trim();
      if (!scheduleId) {
        return [];
      }
      const task = await db.query.scheduledTasks.findFirst({
        where: and(
          eq(scheduledTasks.id, scheduleId),
          eq(scheduledTasks.userId, input.userId),
        ),
        columns: { id: true, lastChatId: true },
      });
      if (task?.lastChatId) {
        await db
          .update(chats)
          .set({ scheduledTaskId: task.id })
          .where(
            and(
              eq(chats.id, task.lastChatId),
              eq(chats.userId, input.userId),
              isNull(chats.scheduledTaskId),
              isNull(chats.projectId),
            ),
          );
      }
      conditions.push(eq(chats.scheduledTaskId, scheduleId));
      conditions.push(isNull(chats.projectId));
    }

    const rows = await db
      .select()
      .from(chats)
      .where(and(...conditions))
      .orderBy(desc(chats.updatedAt));
    return rows.map(toDomainChat);
  }

  async setScheduledTaskIdIfUnset(input: {
    chatId: string;
    userId: string;
    scheduledTaskId: string;
  }): Promise<void> {
    const db = getDb();
    if (!db) return;
    await db
      .update(chats)
      .set({ scheduledTaskId: input.scheduledTaskId, updatedAt: new Date() })
      .where(
        and(
          eq(chats.id, input.chatId),
          eq(chats.userId, input.userId),
          isNull(chats.scheduledTaskId),
          isNull(chats.projectId),
        ),
      );
  }

  async getChatByEveSessionForUser(input: {
    userId: string;
    eveSessionId: string;
  }): Promise<Chat | null> {
    const db = getDb();
    if (!db) return null;
    const chat = await db.query.chats.findFirst({
      where: and(
        eq(chats.eveSessionId, input.eveSessionId),
        eq(chats.userId, input.userId),
        isNull(chats.deletedAt),
      ),
    });
    return chat ? toDomainChat(chat) : null;
  }

  async getChatMetaForUser(input: {
    userId: string;
    chatId: string;
  }): Promise<Chat | null> {
    const db = getDb();
    if (!db) return null;
    const chat = await db.query.chats.findFirst({
      where: and(
        eq(chats.id, input.chatId),
        eq(chats.userId, input.userId),
        isNull(chats.deletedAt),
      ),
    });
    return chat ? toDomainChat(chat) : null;
  }

  async listChatsInactiveSince(input: {
    cutoff: Date;
    agentIds: string[];
  }): Promise<Chat[]> {
    const db = getDb();
    if (!db || input.agentIds.length === 0) return [];

    const rows = await db
      .select()
      .from(chats)
      .where(
        and(
          isNull(chats.deletedAt),
          lt(chats.updatedAt, input.cutoff),
          inArray(chats.agentId, input.agentIds),
        ),
      )
      .orderBy(chats.updatedAt);

    return rows.map(toDomainChat);
  }

  async getChatForUser(input: {
    userId: string;
    chatId: string;
  }): Promise<ChatWithEvents | null> {
    const db = requireDb();
    const chat = await db.query.chats.findFirst({
      where: and(
        eq(chats.id, input.chatId),
        eq(chats.userId, input.userId),
        isNull(chats.deletedAt),
      ),
    });
    if (!chat) return null;

    const events = await db
      .select()
      .from(chatEvents)
      .where(eq(chatEvents.chatId, chat.id))
      .orderBy(chatEvents.emittedAt);

    return {
      ...toDomainChat(chat),
      events: events.map((event) => ({
        id: event.id,
        chatId: event.chatId,
        type: event.type,
        payload: event.payload,
        emittedAt: event.emittedAt,
      })),
    };
  }

  async getChatMetaById(chatId: string): Promise<Chat | null> {
    const db = getDb();
    if (!db) return null;
    const chat = await db.query.chats.findFirst({
      where: and(eq(chats.id, chatId), isNull(chats.deletedAt)),
    });
    return chat ? toDomainChat(chat) : null;
  }

  async listChatEvents(chatId: string): Promise<ChatWithEvents["events"]> {
    const db = getDb();
    if (!db) return [];
    const events = await db
      .select()
      .from(chatEvents)
      .where(eq(chatEvents.chatId, chatId))
      .orderBy(chatEvents.emittedAt);
    return events.map((event) => ({
      id: event.id,
      chatId: event.chatId,
      type: event.type,
      payload: event.payload,
      emittedAt: event.emittedAt,
    }));
  }

  async applyLlmChatTitle(chatId: string, title: string): Promise<boolean> {
    const db = getDb();
    if (!db) return false;
    const now = new Date();
    const [row] = await db
      .update(chats)
      .set({
        title,
        titleSource: "llm",
        titleGeneratedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(chats.id, chatId),
          isNull(chats.deletedAt),
          sql`${chats.titleSource} is distinct from 'user'`,
          sql`${chats.titleSource} is distinct from 'llm'`,
        ),
      )
      .returning({ id: chats.id });
    return Boolean(row);
  }

  async setUserChatTitle(input: {
    userId: string;
    chatId: string;
    title: string;
  }): Promise<boolean> {
    const db = getDb();
    if (!db) return false;
    const now = new Date();
    const [row] = await db
      .update(chats)
      .set({
        title: input.title,
        titleSource: "user",
        updatedAt: now,
      })
      .where(
        and(
          eq(chats.id, input.chatId),
          eq(chats.userId, input.userId),
          isNull(chats.deletedAt),
        ),
      )
      .returning({ id: chats.id });
    return Boolean(row);
  }

  async softDeleteChat(input: {
    userId: string;
    chatId: string;
  }): Promise<boolean> {
    const db = requireDb();
    const [row] = await db
      .update(chats)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(chats.id, input.chatId),
          eq(chats.userId, input.userId),
          isNull(chats.deletedAt),
        ),
      )
      .returning({ id: chats.id });
    return Boolean(row);
  }

  async addChatWorkspaceFileRefs(input: {
    chatId: string;
    workspaceFileIds: readonly string[];
  }): Promise<void> {
    const db = requireDb();
    const ids = [...new Set(input.workspaceFileIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) return;
    await db
      .insert(chatWorkspaceFileRefs)
      .values(
        ids.map((workspaceFileId) => ({
          chatId: input.chatId,
          workspaceFileId,
        })),
      )
      .onConflictDoNothing();
  }

  async listChatWorkspaceFileRefs(input: {
    chatId: string;
    userId: string;
  }): Promise<string[]> {
    const db = getDb();
    if (!db) return [];
    const rows = await db
      .select({ workspaceFileId: chatWorkspaceFileRefs.workspaceFileId })
      .from(chatWorkspaceFileRefs)
      .innerJoin(
        workspaceFiles,
        eq(workspaceFiles.id, chatWorkspaceFileRefs.workspaceFileId),
      )
      .where(
        and(
          eq(chatWorkspaceFileRefs.chatId, input.chatId),
          eq(workspaceFiles.userId, input.userId),
        ),
      );
    return rows.map((row) => row.workspaceFileId);
  }
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}

export const drizzleChatRepository = new DrizzleChatRepository();
