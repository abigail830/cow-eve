import type { PlatformProductKind } from "../../domain/chat/platform-product-turn.types.js";
import type { PlatformProductTurnBundle } from "../../domain/chat/platform-product-turn.types.js";
import { drizzleChatRepository } from "../../infrastructure/persistence/chat/drizzle-chat.repository.js";
import { persistStreamEvent } from "./chat.use-case.js";

function eventHasPlatformInstance(
  payload: unknown,
  product: PlatformProductKind,
  instanceId: string,
): boolean {
  if (!payload || typeof payload !== "object") return false;
  const root = payload as { type?: string; data?: unknown };
  if (root.type !== "message.received") return false;
  const data = root.data as {
    platform?: { product?: string; instanceId?: string };
  };
  return (
    data?.platform?.product === product &&
    data?.platform?.instanceId === instanceId
  );
}

export async function appendPlatformProductTurn(input: {
  userId: string;
  chatId: string;
  bundle: PlatformProductTurnBundle;
  product: PlatformProductKind;
  instanceId: string;
}): Promise<{ appended: boolean; skipped: boolean }> {
  const chat = await drizzleChatRepository.getChatForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) return { appended: false, skipped: false };

  const already = chat.events.some((event) =>
    eventHasPlatformInstance(event.payload, input.product, input.instanceId),
  );
  if (already) return { appended: false, skipped: true };

  for (const event of input.bundle.events) {
    await persistStreamEvent({
      userId: input.userId,
      agentId: chat.agentId,
      eveSessionId: chat.eveSessionId,
      event,
    });
  }

  return { appended: true, skipped: false };
}
