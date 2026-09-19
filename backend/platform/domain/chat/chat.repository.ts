import type { Chat, ChatWithEvents } from "./chat.entity";
import type { PersistableEvent } from "./stream-event.types";

export interface ChatRepository {
  ensureChat(input: {
    userId: string;
    agentId: string;
    eveSessionId: string;
  }): Promise<Chat | null>;

  persistStreamEvent(input: {
    userId: string;
    agentId: string;
    eveSessionId: string;
    event: PersistableEvent;
  }): Promise<void>;

  listChats(input: { userId: string; agentId: string }): Promise<Chat[]>;

  getChatForUser(input: {
    userId: string;
    chatId: string;
  }): Promise<ChatWithEvents | null>;

  getChatByEveSessionForUser(input: {
    userId: string;
    eveSessionId: string;
  }): Promise<Chat | null>;

  getChatMetaForUser(input: {
    userId: string;
    chatId: string;
  }): Promise<Chat | null>;

  listChatsInactiveSince(input: {
    cutoff: Date;
    agentIds: string[];
  }): Promise<Chat[]>;

  softDeleteChat(input: { userId: string; chatId: string }): Promise<boolean>;
}
