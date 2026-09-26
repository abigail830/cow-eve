import type { EveMessage } from "eve/react";

const CLIENT_CONTEXT_PREFIX = "Client context:";

export function parseAttachmentIdsFromClientContext(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed.startsWith(CLIENT_CONTEXT_PREFIX)) return [];
  const jsonPart = trimmed.slice(CLIENT_CONTEXT_PREFIX.length).trim();
  try {
    const payload = JSON.parse(jsonPart) as { attachmentIds?: unknown };
    const raw = payload.attachmentIds;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function attachmentIdsFromMessageParts(
  parts: EveMessage["parts"],
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (part.type !== "text" || !("text" in part)) continue;
    for (const id of parseAttachmentIdsFromClientContext(part.text)) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function isClientContextOnlyMessage(message: EveMessage): boolean {
  if (message.role !== "user") return false;
  const textParts = message.parts.filter(
    (p) => p.type === "text" && "text" in p && p.text.trim(),
  );
  if (textParts.length === 0) return false;
  const hasNonContext = textParts.some(
    (p) =>
      "text" in p &&
      !p.text.trim().startsWith(CLIENT_CONTEXT_PREFIX),
  );
  if (hasNonContext) return false;
  return textParts.some(
    (p) =>
      "text" in p &&
      parseAttachmentIdsFromClientContext(p.text).length > 0,
  );
}

export function userVisibleTextFromParts(parts: EveMessage["parts"]): string {
  const chunks: string[] = [];
  for (const part of parts) {
    if (part.type !== "text" || !("text" in part)) continue;
    const text = part.text;
    if (text.trim().startsWith(CLIENT_CONTEXT_PREFIX)) continue;
    chunks.push(text);
  }
  return chunks.join("\n").trim();
}

export type DisplayUserMessage = {
  message: EveMessage;
  extraAttachmentIds: string[];
};

/** Hide Eve client-context-only user rows; merge their attachment ids into the prior user turn. */
export function collapseUserClientContextMessages(
  messages: readonly EveMessage[],
): DisplayUserMessage[] {
  const out: DisplayUserMessage[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    if (msg.role !== "user") {
      out.push({ message: msg, extraAttachmentIds: [] });
      continue;
    }
    if (isClientContextOnlyMessage(msg)) continue;

    const extraAttachmentIds: string[] = [];
    while (
      i + 1 < messages.length &&
      isClientContextOnlyMessage(messages[i + 1])
    ) {
      extraAttachmentIds.push(
        ...attachmentIdsFromMessageParts(messages[i + 1].parts),
      );
      i += 1;
    }
    out.push({ message: msg, extraAttachmentIds });
  }
  return out;
}
