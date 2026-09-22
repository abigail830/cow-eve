export type ChatAttachment = {
  id: string;
  chatId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: Date;
};

export type ChatAttachmentPublic = {
  id: string;
  chatId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
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
    createdAt: attachment.createdAt.toISOString(),
  };
}
