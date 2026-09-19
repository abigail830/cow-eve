import { and, desc, eq, isNull } from "drizzle-orm";
import type { ChatRepository } from "../../../domain/chat/chat.repository";
import type { Chat, ChatWithEvents } from "../../../domain/chat/chat.entity";
import {
  SKIP_PERSIST_EVENT_TYPES,
  titleFromMessage,
  type PersistableEvent,
} from "../../../domain/chat/stream-event.types";
import {
  getDb,
  getDatabaseUrl,
  chats,
  chatEvents,
  type ChatRow,
} from "../database";

function toDomainChat(row: ChatRow): Chat {
  return {
    id: row.id,
    userId: row.userId,
    agentId: row.agentId,
    eveSessionId: row.eveSessionId,
    title: row.title,
    deletedAt: row.deletedAt,
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

    const [row] = await db
      .insert(chats)
      .values({
        userId: input.userId,
        agentId: input.agentId,
        eveSessionId: input.eveSessionId,
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
    if (SKIP_PERSIST_EVENT_TYPES.has(input.event.type)) return;

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

    await db
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
      .onConflictDoNothing({ target: chatEvents.id });

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
    } else {
      await db
        .update(chats)
        .set({ updatedAt: new Date() })
        .where(eq(chats.id, chat.id));
    }
  }

  async listChats(input: {
    userId: string;
    agentId: string;
  }): Promise<Chat[]> {
    const db = requireDb();
    const rows = await db
      .select()
      .from(chats)
      .where(
        and(
          eq(chats.userId, input.userId),
          eq(chats.agentId, input.agentId),
          isNull(chats.deletedAt),
        ),
      )
      .orderBy(desc(chats.updatedAt));
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
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}

export const drizzleChatRepository = new DrizzleChatRepository();
