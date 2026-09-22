import {
  toPublicAttachment,
  type ChatAttachment,
  type ChatAttachmentPublic,
} from "../../domain/attachment/chat-attachment.entity";
import {
  deleteAttachmentBytes,
  getAttachmentBytes,
  putAttachmentBytes,
} from "../../infrastructure/attachment/attachment-storage.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import { drizzleChatRepository } from "../../infrastructure/persistence/chat/drizzle-chat.repository.js";

const TEXT_INLINE_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

const MAX_INLINE_TEXT_CHARS = 120_000;

function storageKeyFor(attachmentId: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-()+ ]+/g, "_") || "attachment";
  return `${attachmentId}/${safe}`;
}

async function resolveOwnedChat(input: {
  userId: string;
  chatId?: string;
  eveSessionId?: string;
  agentId?: string;
}) {
  if (input.chatId) {
    return drizzleChatRepository.getChatMetaForUser({
      userId: input.userId,
      chatId: input.chatId,
    });
  }
  if (input.eveSessionId) {
    const existing = await drizzleChatRepository.getChatByEveSessionForUser({
      userId: input.userId,
      eveSessionId: input.eveSessionId,
    });
    if (existing) return existing;
    if (!input.agentId) return null;
    return drizzleChatRepository.ensureChat({
      userId: input.userId,
      agentId: input.agentId,
      eveSessionId: input.eveSessionId,
    });
  }
  return null;
}

export async function uploadChatAttachmentForUser(input: {
  userId: string;
  agentId: string;
  chatId?: string;
  eveSessionId?: string;
  filename: string;
  mediaType: string;
  bytes: Uint8Array;
}): Promise<{ attachment: ChatAttachmentPublic | null; error?: string }> {
  const chat = await resolveOwnedChat(input);
  if (!chat) {
    return { attachment: null, error: "Chat not found for this session." };
  }

  const attachmentId = crypto.randomUUID();
  const storageKey = storageKeyFor(attachmentId, input.filename);

  try {
    await putAttachmentBytes(
      chat.id,
      storageKey,
      input.bytes,
      input.mediaType,
    );
    const saved = await drizzleChatAttachmentRepository.upsert({
      chatId: chat.id,
      filename: input.filename,
      mediaType: input.mediaType,
      sizeBytes: input.bytes.byteLength,
      storageKey,
    });
    return { attachment: toPublicAttachment(saved) };
  } catch (err) {
    return {
      attachment: null,
      error: err instanceof Error ? err.message : "Failed to store attachment.",
    };
  }
}

export async function listChatAttachmentsForUser(input: {
  userId: string;
  chatId: string;
}): Promise<ChatAttachmentPublic[]> {
  const chat = await drizzleChatRepository.getChatMetaForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) return [];
  const rows = await drizzleChatAttachmentRepository.listByChatId(chat.id);
  return rows.map(toPublicAttachment);
}

export async function listChatAttachmentsForUserBySession(input: {
  userId: string;
  eveSessionId: string;
}): Promise<ChatAttachmentPublic[]> {
  const rows = await listChatAttachmentsForSession(input);
  return rows.map(toPublicAttachment);
}

export async function deleteChatAttachmentForUser(input: {
  userId: string;
  chatId: string;
  attachmentId: string;
}): Promise<boolean> {
  const chat = await drizzleChatRepository.getChatMetaForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) return false;

  const attachment = await drizzleChatAttachmentRepository.getById({
    chatId: chat.id,
    attachmentId: input.attachmentId,
  });
  if (!attachment) return false;

  const deleted = await drizzleChatAttachmentRepository.deleteById({
    chatId: chat.id,
    attachmentId: input.attachmentId,
  });
  if (deleted) {
    await deleteAttachmentBytes(chat.id, attachment.storageKey);
  }
  return deleted;
}

export async function getChatAttachmentDownloadForUser(input: {
  userId: string;
  chatId: string;
  attachmentId: string;
}): Promise<{ data: Uint8Array; filename: string; mediaType: string } | null> {
  const chat = await drizzleChatRepository.getChatMetaForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) return null;

  const attachment = await drizzleChatAttachmentRepository.getById({
    chatId: chat.id,
    attachmentId: input.attachmentId,
  });
  if (!attachment) return null;

  const data = await getAttachmentBytes(chat.id, attachment.storageKey);
  if (!data) return null;

  return {
    data,
    filename: attachment.filename,
    mediaType: attachment.mediaType,
  };
}

export async function listChatAttachmentsForSession(input: {
  userId: string;
  eveSessionId: string;
}): Promise<ChatAttachment[]> {
  const chat = await drizzleChatRepository.getChatByEveSessionForUser({
    userId: input.userId,
    eveSessionId: input.eveSessionId,
  });
  if (!chat) return [];
  return drizzleChatAttachmentRepository.listByChatId(chat.id);
}

export type ReadChatAttachmentResult =
  | {
      status: "ok";
      attachment: ChatAttachment;
      bytes: Uint8Array;
      text?: string;
    }
  | { status: "error"; message: string };

export async function readChatAttachmentForSession(input: {
  userId: string;
  eveSessionId: string;
  name: string;
}): Promise<ReadChatAttachmentResult> {
  const chat = await drizzleChatRepository.getChatByEveSessionForUser({
    userId: input.userId,
    eveSessionId: input.eveSessionId,
  });
  if (!chat) {
    return { status: "error", message: "Chat not found for this session." };
  }

  const attachment = await drizzleChatAttachmentRepository.findByFilename({
    chatId: chat.id,
    filename: input.name.trim(),
  });
  if (!attachment) {
    return {
      status: "error",
      message: `Attachment not found: ${input.name}. Use read_chat_attachment only for files uploaded in this chat.`,
    };
  }

  const bytes = await getAttachmentBytes(chat.id, attachment.storageKey);
  if (!bytes?.byteLength) {
    return {
      status: "error",
      message: `Attachment bytes missing for ${attachment.filename}.`,
    };
  }

  if (TEXT_INLINE_MIME.has(attachment.mediaType)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const clipped =
      text.length > MAX_INLINE_TEXT_CHARS
        ? `${text.slice(0, MAX_INLINE_TEXT_CHARS)}\n\n[Truncated — file is ${attachment.sizeBytes} bytes.]`
        : text;
    return {
      status: "ok",
      attachment,
      bytes,
      text: clipped,
    };
  }

  return {
    status: "ok",
    attachment,
    bytes,
  };
}
