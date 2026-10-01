import {
  classifyAttachment,
  isDocumentKind,
} from "../../domain/attachment/attachment-kinds.js";
import { workspaceLibraryId } from "../../domain/document/document-scope.js";
import { parsedArtifactInManifest } from "../../domain/docstore/parsed-manifest.js";
import { PARSE_READY_STATUSES } from "../../domain/parse/parse-status.js";
import type { WorkspaceFile } from "../../domain/workspace/workspace-file.entity.js";
import { loadParsedArtifact } from "../../infrastructure/attachment/parsed-artifact-storage.js";
import { listWorkspaceFilesForDocumentIndex } from "../workspace/workspace-file-index.use-case.js";
import {
  type ChatAttachmentIndexEntry,
  buildChatLibrary,
  DocRetrievalError,
} from "./chat-library.js";

export type DocumentIndexEntry = ChatAttachmentIndexEntry & {
  source: "chat" | "workspace";
  /** Tool / client ref: uuid or ws:uuid */
  refId: string;
  scopeId: string;
};

async function loadMetaJson(
  scopeId: string,
  fileId: string,
): Promise<Record<string, unknown> | null> {
  const raw = await loadParsedArtifact(scopeId, fileId, "meta_json");
  if (!raw?.byteLength) return null;
  try {
    return JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function entryFromWorkspaceRow(
  row: WorkspaceFile | null,
  meta: Record<string, unknown> | null,
): DocumentIndexEntry | null {
  if (!row) return null;
  const kind = classifyAttachment({
    filename: row.filename,
    mimeType: row.mediaType,
  });
  if (kind === "image") return null;
  if (!PARSE_READY_STATUSES.has(row.parseStatus)) return null;
  if (
    isDocumentKind(kind) &&
    !parsedArtifactInManifest(row.parsedArtifactManifest, "content_md")
  ) {
    return null;
  }
  let lineCount: number | null = null;
  let pageCount: number | null = null;
  let figureCount = 0;
  const sectionTitles: string[] = [];
  if (meta) {
    lineCount =
      meta.line_count != null ? Number(meta.line_count) : null;
    pageCount =
      meta.page_count != null ? Number(meta.page_count) : null;
    const figures = meta.figures;
    figureCount = Array.isArray(figures) ? figures.length : 0;
    if (Array.isArray(meta.sections)) {
      for (const section of meta.sections.slice(0, 8)) {
        if (typeof section === "object" && section !== null) {
          const title = String((section as { title?: string }).title ?? "").trim();
          if (title) sectionTitles.push(title);
        }
      }
    }
  }
  const scopeId = workspaceLibraryId(row.userId);
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
    source: "workspace",
    refId: `ws:${row.id}`,
    scopeId,
  };
}

export async function buildSessionDocumentLibrary(input: {
  chatId: string;
  userId: string;
  workspaceFileIds: readonly string[];
}): Promise<Map<string, DocumentIndexEntry>> {
  const chatLib = await buildChatLibrary(input.chatId);
  const merged = new Map<string, DocumentIndexEntry>();

  for (const entry of chatLib.values()) {
    merged.set(entry.attachmentId, {
      ...entry,
      source: "chat",
      refId: entry.attachmentId,
      scopeId: input.chatId,
    });
  }

  const ids = [
    ...new Set(
      input.workspaceFileIds.map((rawId) => rawId.trim()).filter(Boolean),
    ),
  ];
  if (ids.length === 0) return merged;

  const rows = await listWorkspaceFilesForDocumentIndex({
    userId: input.userId,
    fileIds: ids,
  });
  const rowById = new Map(rows.map((row) => [row.id, row]));

  for (const id of ids) {
    const row = rowById.get(id);
    if (!row) continue;
    const meta = await loadMetaJson(workspaceLibraryId(row.userId), row.id);
    const entry = entryFromWorkspaceRow(row, meta);
    if (!entry) continue;
    merged.set(entry.refId, entry);
    merged.set(entry.attachmentId, entry);
  }

  return merged;
}

export function assertDocumentLibraryAccess(
  library: Map<string, DocumentIndexEntry>,
  refId: string,
): DocumentIndexEntry {
  const key = refId.trim();
  const entry =
    library.get(key) ??
    library.get(key.startsWith("ws:") ? key.slice(3) : `ws:${key}`);
  if (!entry) {
    throw new DocRetrievalError(
      "not_found",
      `document not found or not ready: ${refId}`,
    );
  }
  if (!PARSE_READY_STATUSES.has(entry.parseStatus)) {
    throw new DocRetrievalError(
      "not_ready",
      `document parse not ready: ${entry.filename}`,
    );
  }
  return entry;
}

export async function loadDocumentContentMd(
  entry: DocumentIndexEntry,
): Promise<string> {
  const raw = await loadParsedArtifact(
    entry.scopeId,
    entry.attachmentId,
    "content_md",
  );
  if (!raw?.byteLength) throw new Error("content_md missing");
  return new TextDecoder("utf-8", { fatal: false }).decode(raw);
}

export async function loadDocumentMeta(
  entry: DocumentIndexEntry,
): Promise<Record<string, unknown>> {
  const meta = await loadMetaJson(entry.scopeId, entry.attachmentId);
  if (!meta) throw new Error("meta_json missing");
  return meta;
}

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length >= 2);
}

function scoreEntry(entry: DocumentIndexEntry, tokens: string[]): number {
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

export function findSessionDocuments(
  library: Map<string, DocumentIndexEntry>,
  query: string,
  limit = 5,
): Array<Record<string, unknown>> {
  const tokens = queryTokens(query.trim());
  const scored: Array<{ entry: DocumentIndexEntry; score: number }> = [];
  const seen = new Set<string>();
  for (const entry of library.values()) {
    if (seen.has(entry.refId)) continue;
    seen.add(entry.refId);
    const score = scoreEntry(entry, tokens);
    if (tokens.length > 0 && score <= 0) continue;
    scored.push({ entry, score: tokens.length > 0 ? score : 1 });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score || a.entry.filename.localeCompare(b.entry.filename),
  );
  return scored.slice(0, limit).map(({ entry, score }) => ({
    attachment_id: entry.refId,
    filename: entry.filename,
    kind: entry.kind,
    source: entry.source,
    score: Math.round(score * 100) / 100,
    parse_status: entry.parseStatus,
  }));
}
