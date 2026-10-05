import { readDynamicMessages } from "./attachment-rehydrate.js";

const CLIENT_CONTEXT_PREFIX = "Client context:";

function textChunksFromMessage(message: unknown): string[] {
  if (!message || typeof message !== "object") return [];
  const record = message as Record<string, unknown>;
  const chunks: string[] = [];

  if (typeof record.content === "string" && record.content.trim()) {
    chunks.push(record.content);
  } else if (Array.isArray(record.content)) {
    for (const part of record.content) {
      if (typeof part === "string" && part.trim()) {
        chunks.push(part);
        continue;
      }
      if (!part || typeof part !== "object") continue;
      const piece = part as Record<string, unknown>;
      if (piece.type === "text" && typeof piece.text === "string") {
        chunks.push(piece.text);
      }
    }
  }

  if (Array.isArray(record.parts)) {
    for (const part of record.parts) {
      if (!part || typeof part !== "object") continue;
      const piece = part as Record<string, unknown>;
      if (piece.type === "text" && typeof piece.text === "string") {
        chunks.push(piece.text);
      }
    }
  }

  return chunks;
}

/** User-typed text from the latest user message, excluding Client context blocks. */
export function extractLatestUserComposerNotes(messages: readonly unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object") continue;
    if ((message as { role?: string }).role !== "user") continue;

    const notes: string[] = [];
    for (const chunk of textChunksFromMessage(message)) {
      const trimmed = chunk.trim();
      if (!trimmed || trimmed.startsWith(CLIENT_CONTEXT_PREFIX)) continue;
      notes.push(chunk);
    }
    return notes.join("\n").trim();
  }
  return "";
}

export function composeGenerationEvidenceText(input: {
  notes: string;
  documentBlocks: string[];
}): string {
  const sections: string[] = [];
  if (input.notes.trim()) {
    sections.push(`--- User message ---\n${input.notes.trim()}`);
  }
  sections.push(...input.documentBlocks.filter((b) => b.trim()));
  return sections.join("\n\n").trim();
}

export { readDynamicMessages };
