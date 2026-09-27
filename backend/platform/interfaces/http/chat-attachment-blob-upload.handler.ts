import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import {
  ATTACHMENT_MAX_BYTES_PER_FILE,
  attachmentBlobPathname,
  CHAT_ATTACHMENT_ALLOWED_MEDIA_TYPES,
  parseBlobUploadClientPayload,
} from "../../application/attachment/chat-attachment-blob-upload.use-case.js";
import { normalizeEnvSecret } from "../../infrastructure/artifact/blob-client.js";

export async function handleChatAttachmentBlobUploadRequest(input: {
  request: Request;
  body: HandleUploadBody;
  userId: string;
}): Promise<
  | { type: "blob.generate-client-token"; clientToken: string }
  | { type: "blob.upload-completed"; response: "ok" }
> {
  const manualToken = normalizeEnvSecret(process.env.BLOB_READ_WRITE_TOKEN);

  return handleUpload({
    request: input.request,
    body: input.body,
    ...(manualToken && !process.env.VERCEL ? { token: manualToken } : {}),
    onBeforeGenerateToken: async (pathname, clientPayload, _multipart) => {
      const payload = parseBlobUploadClientPayload(clientPayload);
      if (!payload) {
        throw new Error("Invalid upload payload.");
      }
      if (payload.userId !== input.userId) {
        throw new Error("Upload not authorized for this user.");
      }
      const expected = attachmentBlobPathname(
        payload.chatId,
        payload.attachmentId,
        payload.filename,
      );
      if (pathname !== expected) {
        throw new Error("Upload pathname does not match prepared attachment.");
      }
      if (payload.sizeBytes > ATTACHMENT_MAX_BYTES_PER_FILE) {
        throw new Error("File exceeds maximum allowed size.");
      }

      return {
        allowedContentTypes: [...CHAT_ATTACHMENT_ALLOWED_MEDIA_TYPES],
        maximumSizeInBytes: ATTACHMENT_MAX_BYTES_PER_FILE,
        addRandomSuffix: false,
        allowOverwrite: false,
        tokenPayload: clientPayload,
        cacheControlMaxAge: 60 * 60 * 24 * 30,
      };
    },
  });
}
