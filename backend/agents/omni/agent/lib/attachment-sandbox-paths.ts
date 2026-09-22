import { createHash } from "node:crypto";

/** Matches Eve inbound attachment staging under `/workspace/attachments`. */
export const ATTACHMENTS_ROOT = "/workspace/attachments";

const UNSAFE_FILENAME_CHARS = /[^\w.\-()+ ]+/g;

export function attachmentBasename(filename: string): string {
  const normalized = filename.replace(/\\/g, "/");
  const last = normalized.split("/").pop();
  return (last?.trim() || filename.trim()) || "attachment";
}

export function safeAttachmentFilename(filename: string): string {
  const safe = attachmentBasename(filename).replace(UNSAFE_FILENAME_CHARS, "_");
  return safe.length > 0 ? safe : "attachment";
}

export function attachmentFilenamesMatch(
  left: string,
  right: string,
): boolean {
  if (!left.trim() || !right.trim()) return false;
  return (
    attachmentBasename(left).toLowerCase() ===
    attachmentBasename(right).toLowerCase()
  );
}

export function eveAttachmentHashPrefix(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

/** Primary path Eve uses after staging inbound file parts. */
export function eveStagedAttachmentPath(
  bytes: Uint8Array,
  filename: string,
): string {
  const hash = eveAttachmentHashPrefix(bytes);
  const safe = safeAttachmentFilename(filename);
  return `${ATTACHMENTS_ROOT}/${hash}/${safe}`;
}

/** Sandbox locations to probe, most specific first. */
export function candidateAttachmentSandboxPaths(
  bytes: Uint8Array,
  filename: string,
): string[] {
  const staged = eveStagedAttachmentPath(bytes, filename);
  const flat = `${ATTACHMENTS_ROOT}/${safeAttachmentFilename(filename)}`;
  return staged === flat ? [staged] : [staged, flat];
}
