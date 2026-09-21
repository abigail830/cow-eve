/** Eve inbound attachment limits — aligned with platform attachment spec. */

export const ATTACHMENT_LIMITS = {
  maxFilesPerMessage: 5,
  /** Per-file upload cap on the wire (backend uploadPolicy). */
  maxBytesPerFile: 20 * 1024 * 1024,
  maxTotalBytesPerMessage: 50 * 1024 * 1024,
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
]);

const OFFICE_EXT = /\.(doc|docx|ppt|pptx)$/i;

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
].join(",");

export type PreparedAttachment = {
  id: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  bytes: Uint8Array;
  /** True when the image was re-encoded (compress / format fix) for the model API. */
  compressed?: boolean;
  originalSizeBytes?: number;
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
  if (OFFICE_EXT.test(name)) {
    return "Word/PPT 不支持，请另存为 PDF 后上传。";
  }

  const mediaType = normalizeMime(file.type, name);
  if (!ALLOWED_MIME.has(mediaType)) {
    return `不支持的文件类型：${mediaType || "unknown"}。`;
  }

  if (isImageMime(mediaType)) {
    if (file.size > ATTACHMENT_LIMITS.imageUploadMaxBytes) {
      return `图片过大（${formatBytes(file.size)}），上限 ${formatBytes(ATTACHMENT_LIMITS.imageUploadMaxBytes)}。`;
    }
  } else if (file.size > ATTACHMENT_LIMITS.maxBytesPerFile) {
    return `文件过大（${formatBytes(file.size)}），单文件上限 ${formatBytes(ATTACHMENT_LIMITS.maxBytesPerFile)}。`;
  }

  return null;
}

export function validateAttachmentBatch(
  existing: readonly PreparedAttachment[],
  incoming: readonly PreparedAttachment[],
): string | null {
  const total = [...existing, ...incoming];
  if (total.length > ATTACHMENT_LIMITS.maxFilesPerMessage) {
    return `每条消息最多 ${ATTACHMENT_LIMITS.maxFilesPerMessage} 个附件。`;
  }
  const sum = total.reduce((n, a) => n + a.sizeBytes, 0);
  if (sum > ATTACHMENT_LIMITS.maxTotalBytesPerMessage) {
    return `附件总大小超过 ${formatBytes(ATTACHMENT_LIMITS.maxTotalBytesPerMessage)}。`;
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
