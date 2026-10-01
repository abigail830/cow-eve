import { detectChatTitleScriptMode } from "./chat-title-clamp.js";

export function buildChatTitleSystemPrompt(): string {
  return [
    "You write short chat thread titles for a sidebar history list.",
    "Reply with the title only — no quotes, no markdown, no explanation.",
    "Match the conversation language (Chinese chat → Chinese title; English → English).",
    "Chinese titles: about 8–16 characters, concise noun phrase.",
    "English titles: about 4–8 words, concise noun phrase.",
    "Do not use generic labels like New chat, Greeting, or Hello.",
  ].join(" ");
}

export function buildChatTitleUserPrompt(input: {
  userMessages: readonly string[];
  assistantReply: string;
}): string {
  const sample = [...input.userMessages, input.assistantReply].join("\n");
  const mode = detectChatTitleScriptMode(sample);
  const lengthHint =
    mode === "cjk"
      ? "Target length: 8–16 Chinese characters."
      : "Target length: 4–8 English words.";

  const parts: string[] = ["Summarize this conversation as a sidebar title.", lengthHint, ""];

  input.userMessages.forEach((text, index) => {
    parts.push(`User ${index + 1}: ${text}`);
  });
  if (input.assistantReply) {
    parts.push(`Assistant (latest): ${input.assistantReply}`);
  }

  return parts.join("\n");
}
