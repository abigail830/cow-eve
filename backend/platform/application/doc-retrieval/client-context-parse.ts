/** Parse Eve `Client context:` payloads from message text (UI + stream events). */

export const CLIENT_CONTEXT_PREFIX = "Client context:";

export function textChunksFromUnknownMessage(message: unknown): string[] {
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

function parseClientContextPayload(jsonPart: string): {
  attachmentIds: string[];
  workspaceFileIds: string[];
} {
  const attachmentIds: string[] = [];
  const workspaceFileIds: string[] = [];
  try {
    const payload = JSON.parse(jsonPart) as {
      attachmentIds?: unknown;
      workspaceFileIds?: unknown;
    };
    const rawAtt = payload.attachmentIds;
    if (Array.isArray(rawAtt)) {
      for (const item of rawAtt) {
        const id = String(item ?? "").trim();
        if (id) attachmentIds.push(id);
      }
    }
    const rawWs = payload.workspaceFileIds;
    if (Array.isArray(rawWs)) {
      for (const item of rawWs) {
        const id = String(item ?? "").trim();
        if (id) workspaceFileIds.push(id);
      }
    }
  } catch {
    // ignore malformed client context
  }
  return { attachmentIds, workspaceFileIds };
}

export function idsFromClientContextChunks(chunks: readonly string[]): {
  attachmentIds: string[];
  workspaceFileIds: string[];
} {
  const attachmentIds: string[] = [];
  const workspaceFileIds: string[] = [];
  const seenAtt = new Set<string>();
  const seenWs = new Set<string>();

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed.startsWith(CLIENT_CONTEXT_PREFIX)) continue;
    const jsonPart = trimmed.slice(CLIENT_CONTEXT_PREFIX.length).trim();
    const parsed = parseClientContextPayload(jsonPart);
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

export function workspaceFileIdsFromMessageReceivedData(
  data: unknown,
): string[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const chunks: string[] = [];
  if (typeof record.message === "string" && record.message.trim()) {
    chunks.push(record.message);
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
  return idsFromClientContextChunks(chunks).workspaceFileIds;
}
