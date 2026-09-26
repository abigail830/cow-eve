import type { ChatAttachment } from "./chat-attachment.entity";

export type ChatAttachmentRepository = {
  upsert(input: {
    chatId: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    storageKey: string;
    contentHash?: string | null;
    parseStatus?: string;
  }): Promise<ChatAttachment>;

  listByChatId(chatId: string): Promise<ChatAttachment[]>;

  getById(input: {
    chatId: string;
    attachmentId: string;
  }): Promise<ChatAttachment | null>;

  findByFilename(input: {
    chatId: string;
    filename: string;
  }): Promise<ChatAttachment | null>;

  deleteById(input: {
    chatId: string;
    attachmentId: string;
  }): Promise<boolean>;
};
