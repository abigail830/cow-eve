import type { UserContent } from "ai";
import { createDataUrlFilePart } from "eve/client";
import { isImageMime, type PreparedAttachment } from "./attachments";

/** Build Eve message payload: only images are inlined; documents use parse-pipeline + tools. */
export function buildMessageContent(
  text: string,
  attachments: readonly PreparedAttachment[],
): string | UserContent {
  const trimmed = text.trim();
  const inlineAttachments = attachments.filter((item) =>
    isImageMime(item.mediaType),
  );

  if (inlineAttachments.length === 0) return trimmed;

  const parts: UserContent = [];
  if (trimmed) {
    parts.push({ type: "text", text: trimmed });
  }
  for (const attachment of inlineAttachments) {
    parts.push(
      createDataUrlFilePart({
        bytes: attachment.bytes,
        filename: attachment.filename,
        mediaType: attachment.mediaType,
      }),
    );
  }
  return parts;
}

export function mergeAttachmentIdsForSend(
  stagedIds: readonly string[],
  mentionIds: readonly string[],
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const id of [...stagedIds, ...mentionIds]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged;
}
