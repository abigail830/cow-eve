import {
  parseSendAttachmentIdsFromMessages,
  parseWorkspaceFileIdsFromMessages,
  readDynamicMessages,
} from "./attachment-rehydrate.js";

export function collectSessionDocumentIds(ctx: unknown): {
  attachmentIds: string[];
  workspaceFileIds: string[];
} {
  const messages = readDynamicMessages(ctx);
  return {
    attachmentIds: parseSendAttachmentIdsFromMessages(messages),
    workspaceFileIds: parseWorkspaceFileIdsFromMessages(messages),
  };
}
