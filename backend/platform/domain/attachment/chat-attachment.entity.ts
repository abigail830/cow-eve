export type ChatAttachment = {
  id: string;
  chatId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  storageKey: string;
  contentHash: string | null;
  parseStatus: string;
  parsePipelineId: string | null;
  parseJobId: string | null;
  parseErrorCode: string | null;
  parseErrorMessage: string | null;
  parseStageSnapshot: Record<string, unknown> | null;
  parsedArtifactManifest: Record<string, unknown> | null;
  gist: string | null;
  gistContentSha256: string | null;
  gistGeneratedAt: Date | null;
  createdAt: Date;
};

export type ChatAttachmentPublic = {
  id: string;
  chatId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  contentHash: string | null;
  parseStatus: string;
  parsePipelineId: string | null;
  parseJobId: string | null;
  parseErrorCode: string | null;
  parseErrorMessage: string | null;
  parseStageSnapshot: Record<string, unknown> | null;
  createdAt: string;
};

export function toPublicAttachment(
  attachment: ChatAttachment,
): ChatAttachmentPublic {
  return {
    id: attachment.id,
    chatId: attachment.chatId,
    filename: attachment.filename,
    mediaType: attachment.mediaType,
    sizeBytes: attachment.sizeBytes,
    contentHash: attachment.contentHash,
    parseStatus: attachment.parseStatus,
    parsePipelineId: attachment.parsePipelineId,
    parseJobId: attachment.parseJobId,
    parseErrorCode: attachment.parseErrorCode,
    parseErrorMessage: attachment.parseErrorMessage,
    parseStageSnapshot: attachment.parseStageSnapshot,
    createdAt: attachment.createdAt.toISOString(),
  };
}
