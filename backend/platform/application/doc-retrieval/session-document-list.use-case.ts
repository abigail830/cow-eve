import { classifyAttachment } from "../../domain/attachment/attachment-kinds.js";
import { listChatAttachmentsForSession } from "../attachment/chat-attachment.use-case.js";
import { listWorkspaceFilesForDocumentIndex } from "../workspace/workspace-file-index.use-case.js";

export type SessionDocumentListItem = {
  attachment_id: string;
  filename: string;
  kind: string;
  source: "chat" | "workspace";
  parse_status: string;
  size_bytes: number;
};

function kindForFilename(filename: string, mediaType: string): string {
  try {
    return classifyAttachment({ filename, mimeType: mediaType });
  } catch {
    return "file";
  }
}

/** Chat attachments + session workspace refs (includes pending parse). */
export async function listSessionDocumentsForAgent(input: {
  userId: string;
  eveSessionId: string;
  workspaceFileIds: readonly string[];
}): Promise<SessionDocumentListItem[]> {
  const byRef = new Map<string, SessionDocumentListItem>();

  const chatRows = await listChatAttachmentsForSession({
    userId: input.userId,
    eveSessionId: input.eveSessionId,
  });
  for (const row of chatRows) {
    byRef.set(row.id, {
      attachment_id: row.id,
      filename: row.filename,
      kind: kindForFilename(row.filename, row.mediaType),
      source: "chat",
      parse_status: row.parseStatus,
      size_bytes: row.sizeBytes,
    });
  }

  const wsRows = await listWorkspaceFilesForDocumentIndex({
    userId: input.userId,
    fileIds: input.workspaceFileIds,
  });
  for (const row of wsRows) {
    const refId = `ws:${row.id}`;
    byRef.set(refId, {
      attachment_id: refId,
      filename: row.filename,
      kind: kindForFilename(row.filename, row.mediaType),
      source: "workspace",
      parse_status: row.parseStatus,
      size_bytes: row.sizeBytes,
    });
  }

  return [...byRef.values()].sort((a, b) =>
    a.filename.localeCompare(b.filename),
  );
}
