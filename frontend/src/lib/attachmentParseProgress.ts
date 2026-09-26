import type { ChatAttachmentPublic } from "./attachmentUpload";
import { isImageMime } from "./attachments";

export const ATTACHMENT_PARSE_POLL_MS = 3000;

export type ParseStageSnapshot = {
  current_stage?: string | null;
  message?: string | null;
  stages?: Array<Record<string, unknown>>;
};

export function effectiveParseStatus(
  attachment: ChatAttachmentPublic,
): string {
  if (attachment.parseStatus) return attachment.parseStatus;
  if (expectsParsePipeline(attachment) || likelyNeedsParse(attachment)) {
    return "pending";
  }
  return "ready";
}

export function expectsParsePipeline(attachment: ChatAttachmentPublic): boolean {
  return Boolean(attachment.parsePipelineId || attachment.parseJobId);
}

export function likelyNeedsParse(attachment: ChatAttachmentPublic): boolean {
  if (expectsParsePipeline(attachment)) return true;
  if (isImageAttachmentRow(attachment)) return false;
  const mime = attachment.mediaType.toLowerCase();
  const name = attachment.filename.toLowerCase();
  if (mime === "application/pdf") return true;
  if (mime.startsWith("text/")) return true;
  if (/\.(pdf|xls|xlsx|csv|tsv|md|markdown|txt)$/.test(name)) return true;
  return false;
}

export function isImageAttachmentRow(attachment: ChatAttachmentPublic): boolean {
  return (
    isImageMime(attachment.mediaType) ||
    /\.(png|jpe?g|gif|webp)$/i.test(attachment.filename)
  );
}

export function parseNotRequired(attachment: ChatAttachmentPublic): boolean {
  const status = effectiveParseStatus(attachment);
  if (status === "skipped") return true;
  return status === "ready" && !likelyNeedsParse(attachment);
}

export function parseStatusLabel(attachment: ChatAttachmentPublic): string {
  if (parseNotRequired(attachment)) return "Ready";
  const status = effectiveParseStatus(attachment);
  switch (status) {
    case "pending":
      return "Queued";
    case "running":
      return "Parsing";
    case "failed":
      return "Parse failed";
    case "ready":
      return "Ready";
    case "skipped":
      return "Skipped";
    default:
      return status;
  }
}

export function attachmentNeedsParsePoll(
  attachments: readonly ChatAttachmentPublic[],
): boolean {
  return attachments.some((row) => {
    if (parseNotRequired(row)) return false;
    const status = effectiveParseStatus(row);
    return status === "pending" || status === "running";
  });
}

export function isParseReady(attachment: ChatAttachmentPublic): boolean {
  const status = effectiveParseStatus(attachment);
  return status === "ready" || status === "skipped";
}

export function isAttachmentReadyForSend(
  attachment: ChatAttachmentPublic,
): boolean {
  return isParseReady(attachment);
}

export function parseStageMessage(
  attachment: ChatAttachmentPublic,
): string | null {
  const snap = attachment.parseStageSnapshot as ParseStageSnapshot | null;
  if (!snap) return null;
  if (typeof snap.message === "string" && snap.message.trim()) {
    return snap.message.trim();
  }
  if (typeof snap.current_stage === "string" && snap.current_stage.trim()) {
    return snap.current_stage.trim();
  }
  return null;
}
