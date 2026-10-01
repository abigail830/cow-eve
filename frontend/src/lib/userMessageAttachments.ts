import type { EveMessage } from "eve/react";

const CLIENT_CONTEXT_PREFIX = "Client context:";

function parseClientContextPayload(text: string): {
  attachmentIds: string[];
  workspaceFileIds: string[];
} {
  const trimmed = text.trim();
  if (!trimmed.startsWith(CLIENT_CONTEXT_PREFIX)) {
    return { attachmentIds: [], workspaceFileIds: [] };
  }
  const jsonPart = trimmed.slice(CLIENT_CONTEXT_PREFIX.length).trim();
  try {
    const payload = JSON.parse(jsonPart) as {
      attachmentIds?: unknown;
      workspaceFileIds?: unknown;
    };
    const attachmentIds = Array.isArray(payload.attachmentIds)
      ? payload.attachmentIds
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      : [];
    const workspaceFileIds = Array.isArray(payload.workspaceFileIds)
      ? payload.workspaceFileIds
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      : [];
    return { attachmentIds, workspaceFileIds };
  } catch {
    return { attachmentIds: [], workspaceFileIds: [] };
  }
}

export function parseAttachmentIdsFromClientContext(text: string): string[] {
  return parseClientContextPayload(text).attachmentIds;
}

export function parseWorkspaceFileIdsFromClientContext(text: string): string[] {
  return parseClientContextPayload(text).workspaceFileIds;
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

export function workspaceFileIdsFromMessageParts(
  parts: EveMessage["parts"],
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (part.type !== "text" || !("text" in part)) continue;
    for (const id of parseWorkspaceFileIdsFromClientContext(part.text)) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function clientContextIdsFromMessageParts(parts: EveMessage["parts"]): {
  attachmentIds: string[];
  workspaceFileIds: string[];
} {
  const attachmentIds: string[] = [];
  const workspaceFileIds: string[] = [];
  const seenAtt = new Set<string>();
  const seenWs = new Set<string>();
  for (const part of parts) {
    if (part.type !== "text" || !("text" in part)) continue;
    const parsed = parseClientContextPayload(part.text);
    for (const id of parsed.attachmentIds) {
      if (seenAtt.has(id)) continue;
      seenAtt.add(id);
      attachmentIds.push(id);
    }
    for (const id of parsed.workspaceFileIds) {
      if (seenWs.has(id)) continue;
      seenWs.add(id);
      workspaceFileIds.push(id);
    }
  }
  return { attachmentIds, workspaceFileIds };
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
  return textParts.some((p) => {
    if (!("text" in p)) return false;
    const ctx = parseClientContextPayload(p.text);
    return ctx.attachmentIds.length > 0 || ctx.workspaceFileIds.length > 0;
  });
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
  extraWorkspaceFileIds: string[];
};

/** Hide Eve client-context-only user rows; merge their attachment ids into the prior user turn. */
export function collapseUserClientContextMessages(
  messages: readonly EveMessage[],
): DisplayUserMessage[] {
  const out: DisplayUserMessage[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    if (msg.role !== "user") {
      out.push({
        message: msg,
        extraAttachmentIds: [],
        extraWorkspaceFileIds: [],
      });
      continue;
    }
    if (isClientContextOnlyMessage(msg)) continue;

    const extraAttachmentIds: string[] = [];
    const extraWorkspaceFileIds: string[] = [];
    while (
      i + 1 < messages.length &&
      isClientContextOnlyMessage(messages[i + 1])
    ) {
      const ctx = clientContextIdsFromMessageParts(messages[i + 1].parts);
      extraAttachmentIds.push(...ctx.attachmentIds);
      extraWorkspaceFileIds.push(...ctx.workspaceFileIds);
      i += 1;
    }
    out.push({ message: msg, extraAttachmentIds, extraWorkspaceFileIds });
  }
  return out;
}
