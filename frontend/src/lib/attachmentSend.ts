import type { UserContent } from "ai";
import { createDataUrlFilePart } from "eve/client";
import { isImageMime, type PreparedAttachment } from "./attachments";

/**
 * Build Eve message payload.
 * - Images: inline file parts (vision).
 * - Documents: no file parts (empty bytes break provider validation); use
 *   clientContext.attachmentIds + parse pipeline instead.
 */
export function buildMessageContent(
  text: string,
  attachments: readonly PreparedAttachment[],
): string | UserContent {
  const trimmed = text.trim();
  const inlineImages = attachments.filter((item) =>
    isImageMime(item.mediaType),
  );

  if (inlineImages.length === 0) return trimmed;

  const parts: UserContent = [];
  if (trimmed) {
    parts.push({ type: "text", text: trimmed });
  }
  for (const attachment of inlineImages) {
    parts.push(
      createDataUrlFilePart({
        bytes: attachment.bytes,
        filename: attachment.filename,
        mediaType: attachment.mediaType,
      }),
    );
  }
  if (parts.length === 1 && parts[0].type === "text") {
    return trimmed;
  }
  return parts;
}

export type SendClientContext = {
  attachmentIds?: readonly string[];
  workspaceFileIds?: readonly string[];
};

/** Eve turn-scoped clientContext is not always visible to agent tools; embed ids in message history too. */
export function formatClientContextText(context: SendClientContext): string | null {
  const attachmentIds = context.attachmentIds?.filter(Boolean) ?? [];
  const workspaceFileIds = context.workspaceFileIds?.filter(Boolean) ?? [];
  if (attachmentIds.length === 0 && workspaceFileIds.length === 0) {
    return null;
  }
  const payload: Record<string, string[]> = {};
  if (attachmentIds.length > 0) payload.attachmentIds = [...attachmentIds];
  if (workspaceFileIds.length > 0) payload.workspaceFileIds = [...workspaceFileIds];
  return `Client context:\n${JSON.stringify(payload)}`;
}

export function mergeClientContextIntoMessage(
  message: string | UserContent,
  context: SendClientContext,
): string | UserContent {
  const ctxText = formatClientContextText(context);
  if (!ctxText) return message;

  const ctxPart = { type: "text" as const, text: ctxText };

  if (typeof message === "string") {
    const trimmed = message.trim();
    if (!trimmed) return [ctxPart];
    return [{ type: "text", text: trimmed }, ctxPart];
  }

  return [...message, ctxPart];
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
