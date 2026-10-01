import { isChatTitleLlmEnabled } from "../../infrastructure/config/chat-title.config.js";
import { generateAndApplyChatTitle } from "./chat-title.use-case.js";

const inflight = new Set<string>();

export function scheduleChatTitleOnce(chatId: string): void {
  if (!isChatTitleLlmEnabled()) return;
  if (inflight.has(chatId)) return;
  inflight.add(chatId);
  void generateAndApplyChatTitle(chatId)
    .catch((err) => {
      console.error("[chat-title] generation failed", chatId, err);
    })
    .finally(() => {
      inflight.delete(chatId);
    });
}
