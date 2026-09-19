import type { Chat, ChatWithEvents } from "../../domain/chat/chat.entity";
import type { PersistableEvent } from "../../domain/chat/stream-event.types";
import { drizzleChatRepository } from "../../infrastructure/persistence/chat/drizzle-chat.repository";

export type { PersistableEvent } from "../../domain/chat/stream-event.types";
export type { Chat, ChatEvent, ChatWithEvents } from "../../domain/chat/chat.entity";

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
  await drizzleChatRepository.persistStreamEvent({
    userId: input.userId,
    agentId: input.agentId,
    eveSessionId: input.eveSessionId,
    event: input.event,
  });
}

export async function listChats(input: {
  userId: string;
  agentId: string;
}): Promise<Chat[]> {
  return drizzleChatRepository.listChats(input);
}

export async function getChatForUser(input: {
  userId: string;
  chatId: string;
}): Promise<ChatWithEvents | null> {
  return drizzleChatRepository.getChatForUser(input);
}

export async function softDeleteChat(input: {
  userId: string;
  chatId: string;
}): Promise<boolean> {
  return drizzleChatRepository.softDeleteChat(input);
}
