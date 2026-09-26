import {
  classifyAttachment,
  isDocumentKind,
} from "../../domain/attachment/attachment-kinds.js";
import { parsedArtifactInManifest } from "../../domain/docstore/parsed-manifest.js";
import { PARSE_READY_STATUSES } from "../../domain/parse/parse-status.js";
import type { ChatAttachment } from "../../domain/attachment/chat-attachment.entity.js";
import { loadParsedArtifact } from "../../infrastructure/attachment/parsed-artifact-storage.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";

export type ChatAttachmentIndexEntry = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  kind: string;
  parseStatus: string;
  gist: string | null;
  sectionTitles: string[];
  lineCount: number | null;
  pageCount: number | null;
  figureCount: number;
  createdAt: string | null;
};

export class DocRetrievalError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function metaSummary(meta: Record<string, unknown>): {
  lineCount: number | null;
  pageCount: number | null;
  figureCount: number;
} {
  const lineCount =
    meta.line_count != null ? Number(meta.line_count) : null;
  const pageCount =
    meta.page_count != null ? Number(meta.page_count) : null;
  const figures = meta.figures;
  const figureCount = Array.isArray(figures) ? figures.length : 0;
  return { lineCount, pageCount, figureCount };
}

async function loadMetaJson(
  chatId: string,
  attachmentId: string,
): Promise<Record<string, unknown> | null> {
  const raw = await loadParsedArtifact(chatId, attachmentId, "meta_json");
  if (!raw?.byteLength) return null;
  try {
    return JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function entryFromRow(
  row: ChatAttachment,
  meta: Record<string, unknown> | null,
): ChatAttachmentIndexEntry {
  const kind = classifyAttachment({
    filename: row.filename,
    mimeType: row.mediaType,
  });
  let lineCount: number | null = null;
  let pageCount: number | null = null;
  let figureCount = 0;
  if (meta) {
    const summary = metaSummary(meta);
    lineCount = summary.lineCount;
    pageCount = summary.pageCount;
    figureCount = summary.figureCount;
  }
  const sectionTitles: string[] = [];
  if (meta && Array.isArray(meta.sections)) {
    for (const section of meta.sections.slice(0, 8)) {
      if (typeof section === "object" && section !== null) {
        const title = String((section as { title?: string }).title ?? "").trim();
        if (title) sectionTitles.push(title);
      }
    }
  }
  return {
    attachmentId: row.id,
    filename: row.filename,
    mimeType: row.mediaType,
    kind,
    parseStatus: row.parseStatus,
    gist: row.gist ?? null,
    sectionTitles,
    lineCount,
    pageCount,
    figureCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function buildChatLibrary(
  chatId: string,
): Promise<Map<string, ChatAttachmentIndexEntry>> {
  const rows = await drizzleChatAttachmentRepository.listByChatId(chatId);
  const library = new Map<string, ChatAttachmentIndexEntry>();
  for (const row of rows) {
    const kind = classifyAttachment({
      filename: row.filename,
      mimeType: row.mediaType,
    });
    if (kind === "image") continue;
    if (!PARSE_READY_STATUSES.has(row.parseStatus)) continue;
    if (
      isDocumentKind(kind) &&
      !parsedArtifactInManifest(row.parsedArtifactManifest, "content_md")
    ) {
      continue;
    }
    const meta = await loadMetaJson(chatId, row.id);
    library.set(row.id, entryFromRow(row, meta));
  }
  return library;
}

export function assertLibraryAccess(
  library: Map<string, ChatAttachmentIndexEntry>,
  attachmentId: string,
): ChatAttachmentIndexEntry {
  const entry = library.get(attachmentId.trim());
  if (!entry) {
    throw new DocRetrievalError(
      "not_found",
      `attachment not found or not ready: ${attachmentId}`,
    );
  }
  if (!PARSE_READY_STATUSES.has(entry.parseStatus)) {
    throw new DocRetrievalError(
      "not_ready",
      `attachment parse not ready: ${entry.filename}`,
    );
  }
  return entry;
}

export async function loadContentMd(
  chatId: string,
  attachmentId: string,
): Promise<string> {
  const raw = await loadParsedArtifact(chatId, attachmentId, "content_md");
  if (!raw?.byteLength) throw new DocRetrievalError("missing", "content_md missing");
  return new TextDecoder("utf-8", { fatal: false }).decode(raw);
}

export async function loadMetaForAttachment(
  chatId: string,
  attachmentId: string,
): Promise<Record<string, unknown>> {
  const meta = await loadMetaJson(chatId, attachmentId);
  if (!meta) throw new DocRetrievalError("missing", "meta_json missing");
  return meta;
}

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length >= 2);
}

function scoreEntry(entry: ChatAttachmentIndexEntry, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const haystacks = [
    entry.filename.toLowerCase(),
    (entry.gist ?? "").toLowerCase(),
    entry.sectionTitles.join(" ").toLowerCase(),
    entry.kind.toLowerCase(),
  ];
  const blob = haystacks.join(" ");
  let score = 0;
  for (const token of tokens) {
    if (entry.filename.toLowerCase().includes(token)) score += 3;
    if (blob.includes(token)) score += 1;
  }
  return score;
}

export function findAttachments(
  library: Map<string, ChatAttachmentIndexEntry>,
  query: string,
  limit = 5,
): Array<Record<string, unknown>> {
  const tokens = queryTokens(query.trim());
  if (tokens.length === 0) return [];

  const scored: Array<{ entry: ChatAttachmentIndexEntry; score: number }> = [];
  for (const entry of library.values()) {
    const score = scoreEntry(entry, tokens);
    if (score <= 0) continue;
    scored.push({ entry, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.entry.filename.localeCompare(b.entry.filename),
  );
  return scored.slice(0, limit).map(({ entry, score }) => ({
    attachment_id: entry.attachmentId,
    filename: entry.filename,
    kind: entry.kind,
    score: Math.round(score * 100) / 100,
    parse_status: entry.parseStatus,
  }));
}
