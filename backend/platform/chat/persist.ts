import { and, desc, eq, isNull } from "drizzle-orm";
import {
  getDb,
  getDatabaseUrl,
  chats,
  chatEvents,
  type Chat,
  type ChatEvent,
} from "../db";

const SKIP_EVENT_TYPES = new Set([
  "message.appended",
  "reasoning.appended",
  "action.partial",
  "action.input_appended",
  "subagent.child_event",
]);

export type PersistableEvent = {
  meta: { id: string; at: string | Date };
  type: string;
  data?: unknown;
};

function titleFromMessage(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "New chat";
  return compact.length <= 40 ? compact : `${compact.slice(0, 40)}…`;
}

export async function ensureChat(input: {
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
    if (existing.deletedAt) return existing;
    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, existing.id));
    return existing;
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

  if (row) return row;

  return (
    (await db.query.chats.findFirst({
      where: eq(chats.eveSessionId, input.eveSessionId),
    })) ?? null
  );
}

export async function persistStreamEvent(input: {
  userId: string | null | undefined;
  agentId: string;
  eveSessionId: string;
  event: PersistableEvent;
}): Promise<void> {
  if (!input.userId) {
    console.warn("[persist-chat] no principalId; skip event", input.event.type);
    return;
  }
  if (!getDb()) {
    if (!getDatabaseUrl()) {
      console.warn("[persist-chat] DATABASE_URL missing; skip event");
    }
    return;
  }
  if (SKIP_EVENT_TYPES.has(input.event.type)) return;

  const chat = await ensureChat({
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
    const data = input.event.data as { message?: string; kind?: string } | null;
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

export async function listChats(input: {
  userId: string;
  agentId: string;
}): Promise<Chat[]> {
  const db = requireDbOrThrow();
  return db
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
}

export async function getChatForUser(input: {
  userId: string;
  chatId: string;
}): Promise<(Chat & { events: ChatEvent[] }) | null> {
  const db = requireDbOrThrow();
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

  return { ...chat, events };
}

export async function softDeleteChat(input: {
  userId: string;
  chatId: string;
}): Promise<boolean> {
  const db = requireDbOrThrow();
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

function requireDbOrThrow() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}
