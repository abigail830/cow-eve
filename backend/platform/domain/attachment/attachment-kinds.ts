/** Classify chat attachments — ported from agent-platform attachments/kinds.py */

export const OFFICE_REJECT_PPT =
  "PowerPoint is not supported here. Save as PDF and upload again.";
export const OFFICE_REJECT_WORD =
  "Word is not supported here. Save as PDF and upload again.";

export type AttachmentKind =
  | "image"
  | "pdf"
  | "sheet"
  | "text"
  | "office"
  | "audio";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const PDF_EXTS = new Set([".pdf"]);
const SHEET_EXTS = new Set([".xls", ".xlsx", ".csv"]);
const TEXT_EXTS = new Set([".txt", ".md", ".json"]);
const PPT_EXTS = new Set([".ppt", ".pptx"]);
const WORD_EXTS = new Set([".doc", ".docx"]);
const AUDIO_EXTS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".flac",
  ".aac",
  ".ogg",
  ".opus",
  ".webm",
]);

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
const PDF_MIMES = new Set(["application/pdf"]);
const SHEET_MIMES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "application/json",
]);
const PPT_MIMES = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const WORD_MIMES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const AUDIO_MIMES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/flac",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
]);

export function normalizeMime(mimeType: string | null | undefined): string {
  return (mimeType ?? "application/octet-stream").split(";")[0]?.trim().toLowerCase() ?? "";
}

export function fileExtension(filename: string): string {
  const name = (filename || "").trim().toLowerCase();
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx) : "";
}

export function classifyAttachment(input: {
  filename: string;
  mimeType: string | null | undefined;
}): AttachmentKind {
  const ext = fileExtension(input.filename);
  const mime = normalizeMime(input.mimeType);
  if (PPT_EXTS.has(ext) || PPT_MIMES.has(mime)) return "office";
  if (WORD_EXTS.has(ext) || WORD_MIMES.has(mime)) return "office";
  if (IMAGE_EXTS.has(ext) || IMAGE_MIMES.has(mime) || mime.startsWith("image/")) {
    return "image";
  }
  if (PDF_EXTS.has(ext) || PDF_MIMES.has(mime)) return "pdf";
  if (SHEET_EXTS.has(ext) || SHEET_MIMES.has(mime)) return "sheet";
  if (TEXT_EXTS.has(ext) || TEXT_MIMES.has(mime)) return "text";
  if (AUDIO_EXTS.has(ext) || AUDIO_MIMES.has(mime) || mime.startsWith("audio/")) {
    return "audio";
  }
  throw new Error(`Unsupported file type: ${mime || input.filename}`);
}

export function officeRejectMessage(input: {
  filename: string;
  mimeType: string | null | undefined;
}): string {
  const ext = fileExtension(input.filename);
  const mime = normalizeMime(input.mimeType);
  if (PPT_EXTS.has(ext) || PPT_MIMES.has(mime)) return OFFICE_REJECT_PPT;
  return OFFICE_REJECT_WORD;
}

export function isDocumentKind(kind: AttachmentKind): boolean {
  return kind !== "image";
}
