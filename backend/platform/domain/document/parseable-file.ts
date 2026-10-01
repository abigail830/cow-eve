import type { ChatAttachment } from "../attachment/chat-attachment.entity.js";
import type { WorkspaceFile } from "../workspace/workspace-file.entity.js";
import {
  type DocumentScope,
  type DocumentSourceKind,
  workspaceLibraryId,
} from "./document-scope.js";

/** Shared shape for parse enqueue / job payload. */
export type ParseableFile = {
  id: string;
  sourceKind: DocumentSourceKind;
  scopeId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  storageKey: string;
  contentHash: string | null;
  /** Set for chat_attachment jobs (legacy parse_job_runs.chat_id). */
  chatId: string | null;
};

export function parseableFromChatAttachment(row: ChatAttachment): ParseableFile {
  return {
    id: row.id,
    sourceKind: "chat_attachment",
    scopeId: row.chatId,
    filename: row.filename,
    mediaType: row.mediaType,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    contentHash: row.contentHash,
    chatId: row.chatId,
  };
}

export function parseableFromWorkspaceFile(
  row: WorkspaceFile,
  userId: string,
): ParseableFile {
  return {
    id: row.id,
    sourceKind: "workspace_file",
    scopeId: workspaceLibraryId(userId),
    filename: row.filename,
    mediaType: row.mediaType,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    contentHash: row.contentHash,
    chatId: null,
  };
}

export function documentScopeFromParseable(row: ParseableFile): DocumentScope {
  return {
    kind: row.sourceKind,
    scopeId: row.scopeId,
    fileId: row.id,
  };
}
