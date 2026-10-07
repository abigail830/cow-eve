/** Turn a clipboard screenshot into a File the attachment pipeline can parse. */

export type ClipboardFileItem = {
  kind: string;
  type: string;
  getAsFile: () => File | null;
};

export type ClipboardImageSource = {
  files?: ArrayLike<File> | null;
  items?: ArrayLike<ClipboardFileItem> | null;
  getData?: (type: string) => string;
};

const GENERIC_CLIPBOARD_NAME =
  /^(blob|file|image\.(png|jpe?g|gif|webp))$/i;

function stripMime(value: string | null | undefined): string {
  return (value ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

function mimeFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

export function resolveClipboardImageMime(
  file: File,
  declaredType = "",
): string | null {
  const fromFile = stripMime(file.type);
  const fromItem = stripMime(declaredType);
  const candidate = fromFile.startsWith("image/")
    ? fromFile
    : fromItem.startsWith("image/")
      ? fromItem
      : mimeFromFilename(file.name);
  if (!candidate?.startsWith("image/")) return null;
  if (candidate === "image/jpg" || candidate === "image/pjpeg") return "image/jpeg";
  return candidate;
}

function extensionForImageMime(mediaType: string): string {
  switch (mediaType) {
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/png":
      return "png";
    default: {
      const sub = mediaType.split("/")[1] ?? "png";
      return sub.replace(/[^a-z0-9]+/g, "") || "png";
    }
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function screenshotFilename(mediaType: string, now: Date): string {
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `screenshot-${stamp}.${extensionForImageMime(mediaType)}`;
}

function isGenericClipboardName(name: string): boolean {
  return GENERIC_CLIPBOARD_NAME.test(name.trim());
}

export function normalizeClipboardImageFile(
  file: File,
  declaredType = "",
  now: Date = new Date(),
): File | null {
  if (file.size <= 0) return null;
  const mediaType = resolveClipboardImageMime(file, declaredType);
  if (!mediaType) return null;
  const filename = isGenericClipboardName(file.name)
    ? screenshotFilename(mediaType, now)
    : file.name || screenshotFilename(mediaType, now);
  if (file.name === filename && stripMime(file.type) === mediaType) return file;
  return new File([file], filename, {
    type: mediaType,
    lastModified: file.lastModified || now.getTime(),
  });
}

function uniqueFilename(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let index = 2;
  let next = `${base}-${index}${ext}`;
  while (used.has(next)) {
    index += 1;
    next = `${base}-${index}${ext}`;
  }
  used.add(next);
  return next;
}

/**
 * Screenshots often arrive with an empty File.type (the MIME is only on the
 * clipboard item) or a generic name like image.png. Normalize those so they
 * follow the same upload path as a paperclip image.
 */
export function imageFilesFromClipboard(
  data: ClipboardImageSource | null | undefined,
  now: Date = new Date(),
): File[] {
  if (!data) return [];
  const seen = new Set<string>();
  const usedNames = new Set<string>();
  const out: File[] = [];

  const consider = (file: File | null, declaredType: string) => {
    if (!file || file.size <= 0) return;
    const mediaType = resolveClipboardImageMime(file, declaredType);
    if (!mediaType) return;
    const key = `${file.size}:${file.name}:${mediaType}`;
    if (seen.has(key)) return;
    seen.add(key);
    const normalized = normalizeClipboardImageFile(file, declaredType, now);
    if (!normalized) return;
    const filename = uniqueFilename(normalized.name, usedNames);
    out.push(
      filename === normalized.name
        ? normalized
        : new File([normalized], filename, {
            type: normalized.type,
            lastModified: normalized.lastModified,
          }),
    );
  };

  const files = data.files;
  if (files) {
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (file) consider(file, file.type);
    }
  }

  const items = data.items;
  if (items) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item) continue;
      const type = stripMime(item.type);
      if (item.kind !== "file" && !type.startsWith("image/")) continue;
      consider(item.getAsFile(), item.type);
    }
  }

  return out;
}

/** Plain text that should stay in the composer when an image is pasted with it. */
export function clipboardTextBesideImages(
  data: ClipboardImageSource | null | undefined,
): string {
  const text = data?.getData?.("text/plain")?.replace(/\0/g, "").trim() ?? "";
  if (!text || GENERIC_CLIPBOARD_NAME.test(text)) return "";
  return text;
}
