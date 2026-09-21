import type { UserContent } from "ai";
import { createDataUrlFilePart } from "eve/client";
import type { PreparedAttachment } from "./attachments";

/** Build the Eve session message payload for text + inline file parts. */
export function buildMessageContent(
  text: string,
  attachments: readonly PreparedAttachment[],
): string | UserContent {
  const trimmed = text.trim();
  if (attachments.length === 0) return trimmed;

  const parts: UserContent = [];
  if (trimmed) {
    parts.push({ type: "text", text: trimmed });
  }
  for (const attachment of attachments) {
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
