import type { ChatAttachmentPublic } from "./attachmentUpload";
import type { WorkspaceFilePublic } from "./workspace";

/** Map workspace file rows into attachment-shaped rows for shared parse UI helpers. */
export function workspaceFileAsAttachmentRow(
  file: WorkspaceFilePublic,
): ChatAttachmentPublic {
  return {
    id: file.id,
    chatId: "",
    filename: file.filename,
    mediaType: file.mediaType,
    sizeBytes: file.sizeBytes,
    parseStatus: file.parseStatus,
    parsePipelineId: file.parsePipelineId,
    parseErrorMessage: file.parseErrorMessage,
    createdAt: file.createdAt,
  };
}
