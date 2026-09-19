import { randomBytes } from "node:crypto";
import path from "node:path";
import type {
  ArtifactPayload,
  ChatArtifactFormat,
  ChatArtifactMeta,
} from "../../domain/artifact/artifact.types.js";
import {
  getArtifactBytes,
  getArtifactMeta,
  putArtifactBytes,
  putArtifactMeta,
} from "./artifact-storage.js";

const MEDIA_TYPES: Record<string, string> = {
  slidev: "text/markdown; charset=utf-8",
  html: "text/html; charset=utf-8",
  pdf: "application/pdf",
  markdown: "text/markdown; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

async function loadMeta(chatId: string, artifactId: string): Promise<ChatArtifactMeta | null> {
  const raw = await getArtifactMeta(chatId, artifactId);
  if (!raw) return null;
  return raw as ChatArtifactMeta;
}

async function writeMeta(chatId: string, artifactId: string, meta: ChatArtifactMeta): Promise<void> {
  await putArtifactMeta(chatId, artifactId, meta);
}

function guessMediaType(filePath: string, fallback = "application/octet-stream"): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".html": MEDIA_TYPES.html,
    ".md": MEDIA_TYPES.markdown,
    ".pdf": MEDIA_TYPES.pdf,
    ".svg": MEDIA_TYPES.svg,
    ".png": MEDIA_TYPES.png,
    ".docx": MEDIA_TYPES.docx,
    ".pptx": MEDIA_TYPES.pptx,
  };
  return map[ext] ?? fallback;
}

export function newChatArtifactId(prefix = "content"): string {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

export async function saveContentFile(input: {
  chatId: string;
  artifactId: string;
  data: Uint8Array;
  filename: string;
  fileFormat: ChatArtifactFormat;
}): Promise<void> {
  const mediaType = MEDIA_TYPES[input.fileFormat] ?? "application/octet-stream";
  const suffix = path.extname(input.filename).toLowerCase();
  const objectName = suffix
    ? `${input.artifactId}${suffix}`
    : `${input.artifactId}/${input.filename.replace(/^\/+/, "")}`;

  await putArtifactBytes(input.chatId, objectName, input.data, mediaType);
  await writeMeta(input.chatId, input.artifactId, {
    kind: "content_document",
    filename: input.filename,
    format: input.fileFormat,
    media_type: mediaType,
    source_object: objectName,
    preview_index: null,
    preview_files: {},
    variants: {},
  });
}

export async function saveSlideDeck(input: {
  chatId: string;
  artifactId: string;
  sourceText: string;
  filename: string;
  distFiles?: Record<string, Uint8Array>;
  deckFormat?: ChatArtifactFormat;
}): Promise<void> {
  const deckFormat = input.deckFormat ?? "html";
  const sourceMedia = MEDIA_TYPES[deckFormat] ?? MEDIA_TYPES.html;
  const sourceObject =
    deckFormat === "slidev" ? `${input.artifactId}.md` : `${input.artifactId}.html`;

  await putArtifactBytes(
    input.chatId,
    sourceObject,
    Buffer.from(input.sourceText, "utf8"),
    sourceMedia,
  );

  const previewFiles: Record<string, string> = {};
  for (const [relPath, data] of Object.entries(input.distFiles ?? {})) {
    const rel = relPath.replace(/^\/+/, "").replace(/\\/g, "/");
    if (!rel || rel.split("/").includes("..")) continue;
    const objectName = `${input.artifactId}/dist/${rel}`;
    await putArtifactBytes(input.chatId, objectName, data, guessMediaType(rel));
    previewFiles[rel] = objectName;
  }

  await writeMeta(input.chatId, input.artifactId, {
    kind: "slide_deck",
    filename: input.filename,
    format: deckFormat,
    media_type: sourceMedia,
    source_object: sourceObject,
    preview_index: previewFiles["index.html"] ? "index.html" : null,
    preview_files: previewFiles,
    variants: {},
  });
}

export async function saveDiagramArtifact(input: {
  chatId: string;
  artifactId: string;
  svg: string;
  png: Uint8Array;
  filenameBase: string;
}): Promise<void> {
  const svgObject = `${input.artifactId}.svg`;
  const pngObject = `${input.artifactId}.png`;
  await putArtifactBytes(input.chatId, svgObject, Buffer.from(input.svg, "utf8"), MEDIA_TYPES.svg);
  await putArtifactBytes(input.chatId, pngObject, input.png, MEDIA_TYPES.png);

  await writeMeta(input.chatId, input.artifactId, {
    kind: "diagram_svg",
    filename: `${input.filenameBase}.svg`,
    format: "svg",
    media_type: MEDIA_TYPES.svg,
    source_object: svgObject,
    preview_index: null,
    preview_files: {},
    variants: {
      png: {
        filename: `${input.filenameBase}.png`,
        format: "png",
        media_type: MEDIA_TYPES.png,
        object_name: pngObject,
      },
    },
  });
}

export async function chatArtifactExists(
  chatId: string,
  artifactId: string,
): Promise<boolean> {
  if (!artifactId || artifactId.includes("..") || artifactId.includes("/")) {
    return false;
  }
  return (await loadMeta(chatId, artifactId)) !== null;
}

export async function getChatArtifactFormat(
  chatId: string,
  artifactId: string,
): Promise<ChatArtifactFormat> {
  const meta = await loadMeta(chatId, artifactId);
  const fmt = meta?.format?.toLowerCase();
  if (
    fmt === "slidev" ||
    fmt === "html" ||
    fmt === "pdf" ||
    fmt === "markdown" ||
    fmt === "docx" ||
    fmt === "pptx" ||
    fmt === "svg"
  ) {
    return fmt;
  }
  return "slidev";
}

export async function loadChatArtifactPayload(input: {
  chatId: string;
  artifactId: string;
  variant?: string | null;
}): Promise<ArtifactPayload | null> {
  if (!(await chatArtifactExists(input.chatId, input.artifactId))) return null;
  const meta = await loadMeta(input.chatId, input.artifactId);
  if (!meta) return null;

  if (input.variant) {
    const entry = meta.variants[input.variant];
    if (!entry?.object_name) return null;
    const raw = await getArtifactBytes(input.chatId, entry.object_name);
    if (!raw) return null;
    return {
      data: raw,
      mediaType: entry.media_type || MEDIA_TYPES.pdf,
      filename: entry.filename || `${input.artifactId}.${input.variant}`,
    };
  }

  const raw = await getArtifactBytes(input.chatId, meta.source_object);
  if (!raw) return null;
  return {
    data: raw,
    mediaType: meta.media_type || MEDIA_TYPES.markdown,
    filename: meta.filename || `${input.artifactId}.md`,
  };
}

export async function loadSlidePreviewPayload(input: {
  chatId: string;
  artifactId: string;
  filePath: string;
}): Promise<ArtifactPayload | null> {
  if (!(await chatArtifactExists(input.chatId, input.artifactId))) return null;
  const meta = await loadMeta(input.chatId, input.artifactId);
  if (!meta) return null;

  let rel = input.filePath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!rel) rel = meta.preview_index ?? "index.html";
  if (!rel || rel.split("/").includes("..")) return null;

  const objectName =
    meta.preview_files[rel] ?? `${input.artifactId}/dist/${rel}`;
  const raw = await getArtifactBytes(input.chatId, objectName);
  if (!raw) return null;

  return {
    data: raw,
    mediaType: guessMediaType(rel),
    filename: path.basename(rel),
  };
}

export function contentDispositionAttachment(filename: string): string {
  const raw = (filename || "download").replace(/\\/g, "/").split("/").pop()?.replace(/"/g, "'") ?? "download";
  const ascii = raw.replace(/[^\x20-\x7E]/g, "").trim() || "download";
  const encoded = encodeURIComponent(raw);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
