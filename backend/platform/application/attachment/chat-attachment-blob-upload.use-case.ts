import { head } from "@vercel/blob";
import { classifyAttachment } from "../../domain/attachment/attachment-kinds.js";
import {
  toPublicAttachment,
  type ChatAttachmentPublic,
} from "../../domain/attachment/chat-attachment.entity.js";
import {
  ATTACHMENT_MAX_BYTES_PER_FILE,
  ATTACHMENT_SERVER_MULTIPART_MAX_BYTES,
  CHAT_ATTACHMENT_ALLOWED_MEDIA_TYPES,
} from "../../infrastructure/config/attachment-limits.config.js";
import {
  blobCommandOptions,
  hasBlobStorageConfigured,
} from "../../infrastructure/artifact/blob-client.js";
import { blobPath } from "../../infrastructure/attachment/attachment-storage.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import { drizzleChatRepository } from "../../infrastructure/persistence/chat/drizzle-chat.repository.js";
import { finalizeAttachmentParse } from "./parse-enqueue.use-case.js";

export type BlobUploadClientPayload = {
  v: 1;
  userId: string;
  chatId: string;
  attachmentId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
};

function storageKeyFor(attachmentId: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-()+ ]+/g, "_") || "attachment";
  return `${attachmentId}/${safe}`;
}

export function attachmentBlobPathname(
  chatId: string,
  attachmentId: string,
  filename: string,
): string {
  return blobPath(chatId, storageKeyFor(attachmentId, filename));
}

export function parseBlobUploadClientPayload(
  raw: string | null,
): BlobUploadClientPayload | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as BlobUploadClientPayload;
    if (data.v !== 1) return null;
    if (!data.userId || !data.chatId || !data.attachmentId || !data.filename) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
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

export function getAttachmentUploadPolicy() {
  return {
    maxBytesPerFile: ATTACHMENT_MAX_BYTES_PER_FILE,
    serverMultipartMaxBytes: ATTACHMENT_SERVER_MULTIPART_MAX_BYTES,
    clientBlobUpload: hasBlobStorageConfigured(),
    allowedMediaTypes: [...CHAT_ATTACHMENT_ALLOWED_MEDIA_TYPES],
  };
}

export async function prepareChatAttachmentBlobUpload(input: {
  userId: string;
  agentId: string;
  chatId?: string;
  eveSessionId?: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
}): Promise<
  | {
      attachmentId: string;
      chatId: string;
      pathname: string;
      clientPayload: string;
    }
  | { error: string }
> {
  if (!hasBlobStorageConfigured()) {
    return { error: "Direct blob upload is not configured on this deployment." };
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > ATTACHMENT_MAX_BYTES_PER_FILE) {
    return {
      error: `File size must be between 1 byte and ${ATTACHMENT_MAX_BYTES_PER_FILE} bytes.`,
    };
  }

  const chat = await resolveOwnedChat(input);
  if (!chat) {
    return { error: "Chat not found for this session." };
  }

  let kind;
  try {
    kind = classifyAttachment({
      filename: input.filename,
      mimeType: input.mediaType,
    });
  } catch {
    return { error: "Unsupported file type." };
  }
  const attachmentId = crypto.randomUUID();
  const pathname = attachmentBlobPathname(
    chat.id,
    attachmentId,
    input.filename,
  );
  const payload: BlobUploadClientPayload = {
    v: 1,
    userId: input.userId,
    chatId: chat.id,
    attachmentId,
    filename: input.filename,
    mediaType: input.mediaType,
    sizeBytes: input.sizeBytes,
  };

  return {
    attachmentId,
    chatId: chat.id,
    pathname,
    clientPayload: JSON.stringify(payload),
  };
}

export async function finalizeChatAttachmentBlobUpload(input: {
  userId: string;
  agentId: string;
  attachmentId: string;
  chatId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  enqueueParse?: boolean;
}): Promise<{ attachment: ChatAttachmentPublic | null; error?: string }> {
  if (!hasBlobStorageConfigured()) {
    return { attachment: null, error: "Blob storage is not configured." };
  }

  const chat = await drizzleChatRepository.getChatMetaForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) {
    return { attachment: null, error: "Chat not found." };
  }

  let kind;
  try {
    kind = classifyAttachment({
      filename: input.filename,
      mimeType: input.mediaType,
    });
  } catch {
    return { attachment: null, error: "Unsupported file type." };
  }

  const pathname = attachmentBlobPathname(
    input.chatId,
    input.attachmentId,
    input.filename,
  );
  const storageKey = storageKeyFor(input.attachmentId, input.filename);

  try {
    const meta = await head(pathname, blobCommandOptions());
    if (!meta) {
      return {
        attachment: null,
        error: "Uploaded file not found in blob storage yet. Retry in a moment.",
      };
    }
  } catch {
    return {
      attachment: null,
      error: "Uploaded file not found in blob storage. Upload may have failed.",
    };
  }

  const sizeBytes = input.sizeBytes > 0 ? input.sizeBytes : 0;
  let saved;
  try {
    saved = await drizzleChatAttachmentRepository.createWithId({
      id: input.attachmentId,
      chatId: input.chatId,
      filename: input.filename,
      mediaType: input.mediaType,
      sizeBytes,
      storageKey,
      contentHash: null,
    });
  } catch (err) {
    return {
      attachment: null,
      error: err instanceof Error ? err.message : "Failed to register attachment.",
    };
  }

  if (input.enqueueParse === false) {
    const skipped =
      (await drizzleChatAttachmentRepository.markParseReady(saved.id, {
        skipped: true,
      })) ?? saved;
    return { attachment: toPublicAttachment(skipped) };
  }

  try {
    const parsed = await finalizeAttachmentParse(saved, kind);
    return { attachment: toPublicAttachment(parsed) };
  } catch (parseErr) {
    const refreshed =
      (await drizzleChatAttachmentRepository.getByIdOnly(saved.id)) ?? saved;
    const parseMessage =
      parseErr instanceof Error ? parseErr.message : "Parse dispatch failed";
    return {
      attachment: toPublicAttachment(refreshed),
      error: `Uploaded, but parse could not start: ${parseMessage}`,
    };
  }
}

export {
  ATTACHMENT_MAX_BYTES_PER_FILE,
  CHAT_ATTACHMENT_ALLOWED_MEDIA_TYPES,
};
