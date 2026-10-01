import { classifyAttachment } from "../../domain/attachment/attachment-kinds.js";
import { workspaceLibraryId } from "../../domain/document/document-scope.js";
import { ParseStatus } from "../../domain/parse/parse-status.js";
import {
  deleteAttachmentBytes,
  getAttachmentBytes,
  putAttachmentBytes,
} from "../../infrastructure/attachment/attachment-storage.js";
import { ATTACHMENT_MAX_BYTES_PER_FILE } from "../../infrastructure/config/attachment-limits.config.js";
import { loadParsedFigureBytes } from "../doc-retrieval/load-parsed-figure.js";
import { loadDocumentPreviewArtifacts } from "../doc-retrieval/document-preview-artifacts.js";
import type { AttachmentKind } from "../../domain/attachment/attachment-kinds.js";
import { drizzleWorkspaceRepository } from "../../infrastructure/persistence/workspace/drizzle-workspace.repository.js";
import {
  finalizeWorkspaceFileParse,
  sha256Bytes,
} from "../attachment/parse-enqueue.use-case.js";

function storageKeyFor(fileId: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-()+ ]+/g, "_") || "file";
  return `${fileId}/${safe}`;
}

export type WorkspaceFilePublic = {
  id: string;
  folderId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  parseStatus: string;
  parsePipelineId: string | null;
  parseErrorMessage: string | null;
  gist: string | null;
  createdAt: string;
};

function toPublic(row: {
  id: string;
  folderId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  parseStatus: string;
  parsePipelineId: string | null;
  parseErrorMessage: string | null;
  gist: string | null;
  createdAt: Date;
}): WorkspaceFilePublic {
  return {
    id: row.id,
    folderId: row.folderId,
    filename: row.filename,
    mediaType: row.mediaType,
    sizeBytes: row.sizeBytes,
    parseStatus: row.parseStatus,
    parsePipelineId: row.parsePipelineId,
    parseErrorMessage: row.parseErrorMessage,
    gist: row.gist,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function uploadWorkspaceFileForUser(input: {
  userId: string;
  folderId: string;
  filename: string;
  mediaType: string;
  bytes: Uint8Array;
}): Promise<{ file: WorkspaceFilePublic | null; error?: string }> {
  if (input.bytes.byteLength > ATTACHMENT_MAX_BYTES_PER_FILE) {
    return { file: null, error: "File exceeds size limit." };
  }
  const folder = await drizzleWorkspaceRepository.getFolderForUser({
    userId: input.userId,
    folderId: input.folderId,
  });
  if (!folder) return { file: null, error: "Folder not found." };

  const fileId = crypto.randomUUID();
  const storageKey = storageKeyFor(fileId, input.filename);
  const scopeId = workspaceLibraryId(input.userId);
  await putAttachmentBytes(scopeId, storageKey, input.bytes, input.mediaType);

  const row = await drizzleWorkspaceRepository.createFile({
    id: fileId,
    userId: input.userId,
    folderId: input.folderId,
    filename: input.filename,
    mediaType: input.mediaType,
    sizeBytes: input.bytes.byteLength,
    storageKey,
    contentHash: sha256Bytes(input.bytes),
  });

  const kind = classifyAttachment({
    filename: input.filename,
    mimeType: input.mediaType,
  });
  try {
    const parsed = await finalizeWorkspaceFileParse(row, kind);
    return { file: toPublic(parsed) };
  } catch (err) {
    const latest =
      (await drizzleWorkspaceRepository.getFileByIdOnly(row.id)) ?? row;
    await drizzleWorkspaceRepository
      .applyParseWebhook(row.id, {
        status: ParseStatus.FAILED,
        errorCode: "UPLOAD_PARSE_ENQUEUE_FAILED",
        errorMessage:
          err instanceof Error ? err.message : "Parse enqueue failed",
      })
      .catch(() => undefined);
    const after =
      (await drizzleWorkspaceRepository.getFileByIdOnly(row.id)) ?? latest;
    return { file: toPublic(after) };
  }
}

export async function listWorkspaceFilesByIdsForUser(input: {
  userId: string;
  fileIds: readonly string[];
}): Promise<WorkspaceFilePublic[]> {
  const rows = await drizzleWorkspaceRepository.listFilesByIdsForUser(input);
  return rows.map(toPublic);
}

export async function listWorkspaceFilesForUser(input: {
  userId: string;
  folderId: string;
}): Promise<WorkspaceFilePublic[]> {
  const folder = await drizzleWorkspaceRepository.getFolderForUser(input);
  if (!folder) return [];
  const rows = await drizzleWorkspaceRepository.listFilesInFolder(input);
  return rows.map(toPublic);
}

export async function deleteWorkspaceFileForUser(input: {
  userId: string;
  fileId: string;
}): Promise<boolean> {
  const row = await drizzleWorkspaceRepository.getFileForUser(input);
  if (!row) return false;
  const scopeId = workspaceLibraryId(row.userId);
  await deleteAttachmentBytes(scopeId, row.storageKey).catch(() => undefined);
  return drizzleWorkspaceRepository.deleteFile(input);
}

export type WorkspaceFilePreviewBundle = {
  file: {
    id: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    parseStatus: string;
    parseErrorMessage: string | null;
    kind: AttachmentKind;
  };
  parsed: {
    markdown: string | null;
    markdownRaw: string | null;
    meta: Record<string, unknown> | null;
    pageindex: Record<string, unknown> | null;
  };
};

export async function getWorkspaceFilePreviewBundleForUser(input: {
  userId: string;
  fileId: string;
}): Promise<WorkspaceFilePreviewBundle | null> {
  const row = await drizzleWorkspaceRepository.getFileForUser(input);
  if (!row) return null;
  const scopeId = workspaceLibraryId(row.userId);
  let kind: AttachmentKind;
  try {
    kind = classifyAttachment({
      filename: row.filename,
      mimeType: row.mediaType,
    });
  } catch {
    kind = "text";
  }
  const parsed = await loadDocumentPreviewArtifacts({
    scopeId,
    documentId: row.id,
  });
  return {
    file: {
      id: row.id,
      filename: row.filename,
      mediaType: row.mediaType,
      sizeBytes: row.sizeBytes,
      parseStatus: row.parseStatus,
      parseErrorMessage: row.parseErrorMessage,
      kind,
    },
    parsed,
  };
}

export async function getWorkspaceFilePreviewForUser(input: {
  userId: string;
  fileId: string;
}): Promise<{ markdown: string } | null> {
  const bundle = await getWorkspaceFilePreviewBundleForUser(input);
  if (!bundle?.parsed.markdown) return null;
  return { markdown: bundle.parsed.markdown };
}

export async function getWorkspaceFileFigureForUser(input: {
  userId: string;
  fileId: string;
  figureRef: string;
}): Promise<{ data: Uint8Array; mediaType: string } | null> {
  const row = await drizzleWorkspaceRepository.getFileForUser({
    userId: input.userId,
    fileId: input.fileId,
  });
  if (!row) return null;
  const scopeId = workspaceLibraryId(row.userId);
  return loadParsedFigureBytes({
    scopeId,
    documentId: row.id,
    figureRef: input.figureRef,
  });
}

export async function getWorkspaceFileDownloadForUser(input: {
  userId: string;
  fileId: string;
}): Promise<{ data: Uint8Array; mediaType: string; filename: string } | null> {
  const row = await drizzleWorkspaceRepository.getFileForUser(input);
  if (!row) return null;
  const scopeId = workspaceLibraryId(row.userId);
  const data = await getAttachmentBytes(scopeId, row.storageKey);
  if (!data?.byteLength) return null;
  return { data, mediaType: row.mediaType, filename: row.filename };
}
