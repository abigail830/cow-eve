import { attachmentBasename, attachmentFilenamesMatch } from "./attachment-sandbox-paths.js";

const SANDBOX_REF_SCHEME = "eve-sandbox:";
const EVE_URL_SCHEME = "eve-url:";

/** Parse `@filename` tokens from composer text (no re-attach). */
export function parseMentionedFilenames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const match of text.matchAll(/@([^\s@]+)/g)) {
    const name = match[1]?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function messageParts(message: unknown): unknown[] {
  if (!message || typeof message !== "object") return [];
  const record = message as Record<string, unknown>;
  if (Array.isArray(record.content)) return record.content;
  if (Array.isArray(record.parts)) return record.parts;
  return [];
}

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

function idsFromClientContextChunks(chunks: readonly string[]): {
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

function partFilename(part: Record<string, unknown>): string {
  return typeof part.filename === "string" ? part.filename.trim() : "";
}

function isInternalRefString(data: string): boolean {
  return (
    data.startsWith(SANDBOX_REF_SCHEME) ||
    data.startsWith(EVE_URL_SCHEME) ||
    data.startsWith("eve-attachment:")
  );
}

function isSandboxRefData(data: unknown): boolean {
  if (data instanceof URL) return data.protocol === "eve-sandbox:";
  return typeof data === "string" && data.startsWith(SANDBOX_REF_SCHEME);
}

function sandboxRefStoragePath(data: unknown): string | null {
  try {
    const url =
      data instanceof URL
        ? data
        : typeof data === "string" && data.startsWith(SANDBOX_REF_SCHEME)
          ? new URL(data)
          : null;
    if (!url || url.protocol !== "eve-sandbox:") return null;
    const path = url.searchParams.get("path");
    return path?.trim() || null;
  } catch {
    return null;
  }
}

function hasInlineBytes(data: unknown): boolean {
  if (data == null) return false;

  if (data instanceof Uint8Array) return data.byteLength > 0;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
    return data.byteLength > 0;
  }

  if (typeof data === "string") {
    if (data.length === 0 || isInternalRefString(data)) return false;
    return true;
  }

  if (data instanceof URL) {
    if (data.protocol === "eve-sandbox:") return false;
    return data.href.length > 0;
  }

  return false;
}

function partMatchesFilename(
  part: Record<string, unknown>,
  filename: string,
): boolean {
  const declared = partFilename(part);
  const refPath = sandboxRefStoragePath(part.data);
  const refBasename = refPath ? attachmentBasename(refPath) : "";
  return (
    attachmentFilenamesMatch(declared, filename) ||
    (refBasename.length > 0 && attachmentFilenamesMatch(refBasename, filename))
  );
}

/**
 * True when history still carries bytes or an Eve sandbox ref Eve can hydrate
 * on the next model call (recent window — no read_chat_attachment needed).
 */
export function isAccessibleFilePart(
  part: unknown,
  filename: string,
): boolean {
  if (!part || typeof part !== "object") return false;
  const record = part as Record<string, unknown>;
  if (!partMatchesFilename(record, filename)) return false;

  const type = record.type;
  if (type === "file") {
    if (isSandboxRefData(record.data)) return true;
    if (hasInlineBytes(record.data)) return true;
    if (typeof record.url === "string" && record.url.length > 0) return true;
    return false;
  }

  if (type === "image") {
    return hasInlineBytes(record.image) || hasInlineBytes(record.data);
  }

  return false;
}

export function historyHasAccessibleFile(
  messages: readonly unknown[],
  filename: string,
): boolean {
  for (const message of messages) {
    for (const part of messageParts(message)) {
      if (isAccessibleFilePart(part, filename)) return true;
    }
  }
  return false;
}

/** @deprecated Use {@link historyHasAccessibleFile}. */
export function historyHasInlineFile(
  messages: readonly unknown[],
  filename: string,
): boolean {
  return historyHasAccessibleFile(messages, filename);
}

/** @deprecated Use {@link isAccessibleFilePart}. */
export function isInlineFilePart(part: unknown, filename: string): boolean {
  return isAccessibleFilePart(part, filename);
}

export function extractLatestUserText(messages: readonly unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object") continue;
    const record = message as Record<string, unknown>;
    if (record.role !== "user") continue;

    if (typeof record.content === "string") {
      return record.content;
    }

    if (Array.isArray(record.content)) {
      const chunks: string[] = [];
      for (const part of record.content) {
        if (!part || typeof part !== "object") continue;
        const piece = part as Record<string, unknown>;
        if (piece.type === "text" && typeof piece.text === "string") {
          chunks.push(piece.text);
        }
      }
      if (chunks.length > 0) return chunks.join("\n");
    }
  }
  return "";
}

/** Filenames @mentioned this turn that need read_chat_attachment (not in history). */
export function filenamesNeedingRehydration(
  messages: readonly unknown[],
  mentionedFilenames: readonly string[],
): string[] {
  return mentionedFilenames.filter(
    (filename) => !historyHasAccessibleFile(messages, filename),
  );
}

export function readDynamicMessages(ctx: unknown): readonly unknown[] {
  if (!ctx || typeof ctx !== "object") return [];
  const messages = (ctx as { messages?: unknown }).messages;
  return Array.isArray(messages) ? messages : [];
}

const CLIENT_CONTEXT_PREFIX = "Client context:";

/** Attachment ids from Eve turn-scoped clientContext (JSON object with attachmentIds). */
export function parseSendAttachmentIdsFromMessages(
  messages: readonly unknown[],
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const message of messages) {
    const parsed = idsFromClientContextChunks(textChunksFromMessage(message));
    for (const id of parsed.attachmentIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** Workspace file ids referenced in Client context across the thread. */
export function parseWorkspaceFileIdsFromMessages(
  messages: readonly unknown[],
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const message of messages) {
    const parsed = idsFromClientContextChunks(textChunksFromMessage(message));
    for (const id of parsed.workspaceFileIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
