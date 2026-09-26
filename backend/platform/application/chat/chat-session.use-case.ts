import { drizzleChatRepository } from "../../infrastructure/persistence/chat/drizzle-chat.repository.js";

export async function resolveChatIdForEveSession(input: {
  userId: string;
  eveSessionId: string;
}): Promise<string | null> {
  const chat = await drizzleChatRepository.getChatByEveSessionForUser({
    userId: input.userId,
    eveSessionId: input.eveSessionId,
  });
  return chat?.id ?? null;
}
