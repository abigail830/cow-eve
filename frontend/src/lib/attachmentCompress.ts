import {
  ATTACHMENT_LIMITS,
  fileToAttachmentMeta,
  isImageMime,
  sniffImageMime,
  withImageExtension,
  type PreparedAttachment,
  validateAttachmentBatch,
  validateAttachmentFile,
} from "./attachments";

async function readFileBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("无法读取图片，文件可能已损坏。"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("图片处理失败。"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function shouldReencodeImage(input: {
  declaredMime: string;
  sniffedMime: string | null;
  byteLength: number;
}): boolean {
  if (!input.sniffedMime) return true;
  if (input.declaredMime !== input.sniffedMime) return true;
  // Qwen rejects some PNGs with alpha / odd metadata; JPEG is safest for vision APIs.
  if (input.sniffedMime === "image/png") return true;
  if (input.byteLength > ATTACHMENT_LIMITS.imageInlineTargetBytes) return true;
  return false;
}

async function reencodeImageViaCanvas(
  file: File,
  outputType: string,
  targetMaxBytes: number,
): Promise<Uint8Array> {
  const img = await loadImageFromFile(file);
  let maxEdge = Math.max(img.naturalWidth, img.naturalHeight);
  let quality = 0.9;
  let lastBytes: Uint8Array | null = null;

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const scale = maxEdge > 4096 ? 4096 / maxEdge : 1;
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器不支持图片处理。");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, outputType, quality);
    const bytes = await blobToBytes(blob);
    lastBytes = bytes;
    if (bytes.byteLength <= targetMaxBytes) return bytes;

    if (quality > 0.45) {
      quality -= 0.08;
    } else if (maxEdge > 1280) {
      maxEdge = Math.round(maxEdge * 0.82);
    } else {
      break;
    }
  }

  if (lastBytes) return lastBytes;
  throw new Error("图片处理失败。");
}

/**
 * Normalize images so declared MIME, filename, and bytes match what Qwen /
 * other vision APIs expect (data:image/jpeg;base64,... must be valid JPEG).
 */
export async function normalizeImageForUpload(
  file: File,
  originalBytes: Uint8Array,
): Promise<{ bytes: Uint8Array; compressed: boolean; mediaType: string }> {
  const { mediaType: declaredMime } = fileToAttachmentMeta(file);
  if (!isImageMime(declaredMime)) {
    return { bytes: originalBytes, compressed: false, mediaType: declaredMime };
  }

  const sniffedMime = sniffImageMime(originalBytes);
  if (!sniffedMime && !shouldReencodeImage({ declaredMime, sniffedMime, byteLength: originalBytes.byteLength })) {
    throw new Error("图片格式无效或已损坏，请换一张 png/jpeg/gif/webp 图片。");
  }

  const needsWork = shouldReencodeImage({
    declaredMime,
    sniffedMime,
    byteLength: originalBytes.byteLength,
  });

  if (!needsWork && sniffedMime) {
    return {
      bytes: originalBytes,
      compressed: false,
      mediaType: sniffedMime,
    };
  }

  const outputType = "image/jpeg";
  const bytes = await reencodeImageViaCanvas(
    file,
    outputType,
    ATTACHMENT_LIMITS.imageInlineTargetBytes,
  );

  return {
    bytes,
    compressed: true,
    mediaType: outputType,
  };
}

export async function prepareAttachmentFromFile(
  file: File,
  existing: readonly PreparedAttachment[],
): Promise<PreparedAttachment> {
  const validationError = validateAttachmentFile(file);
  if (validationError) throw new Error(validationError);

  const originalBytes = await readFileBytes(file);
  const { filename } = fileToAttachmentMeta(file);
  const { bytes, compressed, mediaType } = await normalizeImageForUpload(
    file,
    originalBytes,
  );

  const candidate: PreparedAttachment = {
    id: crypto.randomUUID(),
    filename: isImageMime(mediaType)
      ? withImageExtension(filename, mediaType)
      : filename,
    mediaType,
    sizeBytes: bytes.byteLength,
    bytes,
    compressed,
    originalSizeBytes: compressed ? originalBytes.byteLength : undefined,
  };

  const batchError = validateAttachmentBatch(existing, [candidate]);
  if (batchError) throw new Error(batchError);

  if (candidate.sizeBytes > ATTACHMENT_LIMITS.maxBytesPerFile) {
    throw new Error(
      `压缩后仍超过单文件上限（${ATTACHMENT_LIMITS.maxBytesPerFile / (1024 * 1024)} MB）。请换一张更小的图片。`,
    );
  }

  return candidate;
}

export async function prepareAttachmentsFromFiles(
  files: readonly File[],
  existing: readonly PreparedAttachment[],
): Promise<PreparedAttachment[]> {
  const next = [...existing];
  const added: PreparedAttachment[] = [];
  for (const file of files) {
    const prepared = await prepareAttachmentFromFile(file, next);
    next.push(prepared);
    added.push(prepared);
  }
  return added;
}
