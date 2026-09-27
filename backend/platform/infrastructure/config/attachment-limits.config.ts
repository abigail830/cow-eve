/** Max single attachment size (client blob upload on Vercel; local disk when not on Vercel). */
export const ATTACHMENT_MAX_BYTES_PER_FILE = 50 * 1024 * 1024;

/** Max total attachment bytes referenced in one user message. */
export const ATTACHMENT_MAX_BYTES_PER_MESSAGE = 100 * 1024 * 1024;

/**
 * Bodies above this size must use browser → Vercel Blob direct upload (not multipart via serverless).
 * Vercel serverless request limit is ~4.5 MB.
 */
export const ATTACHMENT_SERVER_MULTIPART_MAX_BYTES = 4 * 1024 * 1024;

export const CHAT_ATTACHMENT_ALLOWED_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
