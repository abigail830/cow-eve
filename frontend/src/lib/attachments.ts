/** Eve inbound attachment limits — aligned with platform attachment spec. */

export const ATTACHMENT_LIMITS = {
  maxFilesPerMessage: 8,
  /** Per-file cap (direct blob upload on Vercel; multipart API below serverMultipartMaxBytes). */
  maxBytesPerFile: 60 * 1024 * 1024,
  maxTotalBytesPerMessage: 480 * 1024 * 1024,
  /** Max audio files in one audio transcript capture. */
  maxAudioFilesPerCapture: 8,
  /** Above this size the browser uploads directly to Vercel Blob (not via /api/chat-attachments). */
  serverMultipartMaxBytes: 4 * 1024 * 1024,
  /**
   * Eve hydrates images ≤ 3 MiB as inline bytes for multimodal models.
   * Larger images become sandbox path references only.
   */
  imageInlineTargetBytes: 3 * 1024 * 1024,
  /** Client accepts slightly larger raw images when compression will shrink them. */
  imageUploadMaxBytes: 8 * 1024 * 1024,
} as const;

const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const ALLOWED_MIME = new Set([
  ...IMAGE_MIME,
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const ATTACHMENT_ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xls",
  ".xlsx",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
].join(",");

export type AttachmentUploadState =
  | "local"
  | "uploading"
  | "uploaded"
  | "error";

export type PreparedAttachment = {
  id: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  bytes: Uint8Array;
  /** True when the image was re-encoded (compress / format fix) for the model API. */
  compressed?: boolean;
  originalSizeBytes?: number;
  /** Platform attachment library id after upload. */
  platformId?: string;
  platformChatId?: string;
  uploadState?: AttachmentUploadState;
  uploadError?: string;
};

/** Detect image format from magic bytes — Qwen validates content, not the filename. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function withImageExtension(filename: string, mediaType: string): string {
  const base = filename.replace(/\.[^.]+$/, "") || "image";
  switch (mediaType) {
    case "image/jpeg":
      return `${base}.jpg`;
    case "image/png":
      return `${base}.png`;
    case "image/gif":
      return `${base}.gif`;
    case "image/webp":
      return `${base}.webp`;
    default:
      return filename;
  }
}

export function isImageMime(mediaType: string): boolean {
  return IMAGE_MIME.has(mediaType) || mediaType.startsWith("image/");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateAttachmentFile(file: File): string | null {
  const name = file.name || "file";

  const mediaType = normalizeMime(file.type, name);
  if (!ALLOWED_MIME.has(mediaType)) {
    return `Unsupported file type: ${mediaType || "unknown"}.`;
  }

  if (isImageMime(mediaType)) {
    if (file.size > ATTACHMENT_LIMITS.imageUploadMaxBytes) {
      return `Image is too large (${formatBytes(file.size)}). Max ${formatBytes(ATTACHMENT_LIMITS.imageUploadMaxBytes)}.`;
    }
  } else if (file.size > ATTACHMENT_LIMITS.maxBytesPerFile) {
    return `File is too large (${formatBytes(file.size)}). Max ${formatBytes(ATTACHMENT_LIMITS.maxBytesPerFile)} per file.`;
  }

  return null;
}

export function validateAttachmentBatch(
  existing: readonly PreparedAttachment[],
  incoming: readonly PreparedAttachment[],
): string | null {
  const total = [...existing, ...incoming];
  if (total.length > ATTACHMENT_LIMITS.maxFilesPerMessage) {
    return `At most ${ATTACHMENT_LIMITS.maxFilesPerMessage} attachments per message.`;
  }
  const sum = total.reduce((n, a) => n + a.sizeBytes, 0);
  if (sum > ATTACHMENT_LIMITS.maxTotalBytesPerMessage) {
    return `Total attachment size exceeds ${formatBytes(ATTACHMENT_LIMITS.maxTotalBytesPerMessage)}.`;
  }
  return null;
}

function normalizeMime(type: string, filename: string): string {
  if (type && type !== "application/octet-stream") return type;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return type || "application/octet-stream";
}

export function fileToAttachmentMeta(file: File): {
  filename: string;
  mediaType: string;
} {
  return {
    filename: file.name || "attachment",
    mediaType: normalizeMime(file.type, file.name),
  };
}
