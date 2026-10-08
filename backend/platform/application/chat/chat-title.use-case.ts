import {
  CHAT_TITLE_LLM_MAX_TOKENS,
  CHAT_TITLE_PROMPT_MAX_CHARS,
  CHAT_TITLE_SNIPPET_MAX_CHARS,
  getTitleLlmAfterUserTurn,
  isChatTitleLlmEnabled,
} from "../../infrastructure/config/chat-title.config.js";
import { drizzleChatRepository } from "../../infrastructure/persistence/chat/drizzle-chat.repository.js";
import { completeUtilityChat } from "../llm/utility-chat-completion.js";
import { clampChatTitle } from "./chat-title-clamp.js";
import {
  countUserTurnMessages,
  extractLastAssistantText,
  extractUserMessageTexts,
} from "./chat-title-events.js";
import {
  buildChatTitleSystemPrompt,
  buildChatTitleUserPrompt,
} from "./chat-title-prompt.js";

function truncatePromptBody(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

/** Interim titles stay until an LLM title lands. Retry after the trigger turn. */
export function shouldGenerateChatTitle(input: {
  titleSource: string | null;
  userTurnCount: number;
  triggerTurn: number;
}): boolean {
  if (input.titleSource === "user" || input.titleSource === "llm") return false;
  return input.userTurnCount >= input.triggerTurn;
}

export async function generateAndApplyChatTitle(chatId: string): Promise<boolean> {
  if (!isChatTitleLlmEnabled()) return false;

  const meta = await drizzleChatRepository.getChatMetaById(chatId);
  if (!meta) return false;

  const events = await drizzleChatRepository.listChatEvents(chatId);
  const userTurnCount = countUserTurnMessages(events);
  const triggerTurn = getTitleLlmAfterUserTurn();
  if (
    !shouldGenerateChatTitle({
      titleSource: meta.titleSource,
      userTurnCount,
      triggerTurn,
    })
  ) {
    return false;
  }

  const userMessages = extractUserMessageTexts(
    events,
    triggerTurn,
    CHAT_TITLE_SNIPPET_MAX_CHARS,
  );
  if (userMessages.length === 0) return false;

  const assistantReply = extractLastAssistantText(
    events,
    CHAT_TITLE_SNIPPET_MAX_CHARS,
  );

  const userPrompt = truncatePromptBody(
    buildChatTitleUserPrompt({ userMessages, assistantReply }),
    CHAT_TITLE_PROMPT_MAX_CHARS,
  );

  let raw: string;
  try {
    raw = await completeUtilityChat({
      system: buildChatTitleSystemPrompt(),
      user: userPrompt,
      maxTokens: CHAT_TITLE_LLM_MAX_TOKENS,
      temperature: 0.2,
    });
  } catch (err) {
    console.error("[chat-title] utility LLM failed", chatId, err);
    return false;
  }

  const hint = [...userMessages, assistantReply].join("\n");
  const title = clampChatTitle(raw, hint);
  if (!title) return false;

  return drizzleChatRepository.applyLlmChatTitle(chatId, title);
}

export async function renameChatTitleForUser(input: {
  userId: string;
  chatId: string;
  title: string;
}): Promise<boolean> {
  const trimmed = input.title.replace(/\s+/g, " ").trim();
  if (!trimmed) return false;
  return drizzleChatRepository.setUserChatTitle({
    userId: input.userId,
    chatId: input.chatId,
    title: trimmed,
  });
}
