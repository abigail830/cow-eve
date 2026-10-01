import {
  artifactDownloadPath,
  artifactPreviewPath,
  type ArtifactFormat,
  type ArtifactKind,
  type ArtifactSpec,
} from "../../../../packages/artifact-spec/src/index.js";
import type { ChatArtifactMeta } from "../../domain/artifact/artifact.types.js";
import {
  getArtifactBytes,
  getArtifactMeta,
} from "../../infrastructure/artifact/artifact-storage.js";

const PREVIEW_CHAR_LIMIT = 120_000;

function asArtifactKind(kind: string | undefined): ArtifactKind {
  if (
    kind === "proposal_preview" ||
    kind === "proposal_document" ||
    kind === "proposal_word" ||
    kind === "diagram_svg" ||
    kind === "slide_deck" ||
    kind === "content_document"
  ) {
    return kind;
  }
  return "content_document";
}

function asArtifactFormat(format: string | undefined): ArtifactFormat {
  if (
    format === "markdown" ||
    format === "docx" ||
    format === "svg" ||
    format === "slidev" ||
    format === "html" ||
    format === "pdf" ||
    format === "pptx" ||
    format === "png"
  ) {
    return format;
  }
  return "markdown";
}

function parseMeta(raw: Record<string, unknown> | null): ChatArtifactMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const filename = typeof raw.filename === "string" ? raw.filename : "artifact";
  const kind = typeof raw.kind === "string" ? raw.kind : "content_document";
  const format = typeof raw.format === "string" ? raw.format : "markdown";
  const media_type = typeof raw.media_type === "string" ? raw.media_type : "";
  const source_object =
    typeof raw.source_object === "string" ? raw.source_object : "";
  const preview_index =
    raw.preview_index === null || typeof raw.preview_index === "string"
      ? raw.preview_index
      : null;
  const preview_files =
    raw.preview_files && typeof raw.preview_files === "object"
      ? (raw.preview_files as Record<string, string>)
      : {};
  const variants =
    raw.variants && typeof raw.variants === "object"
      ? (raw.variants as ChatArtifactMeta["variants"])
      : {};
  return {
    kind,
    filename,
    format: format as ChatArtifactMeta["format"],
    media_type,
    source_object,
    preview_index,
    preview_files,
    variants,
  };
}

export async function buildChatArtifactSpec(input: {
  chatId: string;
  artifactId: string;
  title?: string | null;
}): Promise<ArtifactSpec | null> {
  const raw = await getArtifactMeta(input.chatId, input.artifactId);
  const meta = parseMeta(raw);
  if (!meta?.source_object) return null;

  const kind = asArtifactKind(meta.kind);
  const format = asArtifactFormat(meta.format);
  const cardTitle = (input.title?.trim() || meta.filename || "Artifact").trim();
  const downloadUrl = artifactDownloadPath(input.chatId, input.artifactId);

  let content = "";
  let previewTruncated = false;
  let previewUrl: string | null = null;

  if (kind === "slide_deck" || format === "html") {
    previewUrl = artifactPreviewPath(input.chatId, input.artifactId);
    const rawBytes = await getArtifactBytes(input.chatId, meta.source_object);
    if (rawBytes) {
      const htmlText = new TextDecoder().decode(rawBytes);
      previewTruncated = htmlText.length > PREVIEW_CHAR_LIMIT;
      if (!previewTruncated) content = htmlText;
    }
  } else if (format === "png") {
    /* Raster deliverable — preview via download URL, not inline text. */
  } else if (
    format === "markdown" ||
    /\.(?:puml|plantuml)$/i.test(meta.filename)
  ) {
    if (format === "markdown" && !/\.(?:puml|plantuml)$/i.test(meta.filename)) {
      previewUrl = artifactPreviewPath(input.chatId, input.artifactId);
    }
    const rawBytes = await getArtifactBytes(input.chatId, meta.source_object);
    if (rawBytes) {
      const mdText = new TextDecoder().decode(rawBytes);
      previewTruncated = mdText.length > PREVIEW_CHAR_LIMIT;
      content = previewTruncated ? "" : mdText;
    }
  } else if (kind === "diagram_svg" || format === "svg") {
    const rawBytes = await getArtifactBytes(input.chatId, meta.source_object);
    if (rawBytes) {
      const svgText = new TextDecoder().decode(rawBytes);
      previewTruncated = svgText.length > PREVIEW_CHAR_LIMIT;
      content = previewTruncated ? "" : svgText;
    }
  }

  const pngVariant = meta.variants.png;
  const pdfVariant = meta.variants.pdf;

  return {
    kind: kind === "diagram_svg" ? "diagram_svg" : kind,
    title: cardTitle,
    format,
    content,
    filename: meta.filename,
    artifact_id: input.artifactId,
    download_url: downloadUrl,
    preview_url: previewUrl,
    preview_truncated: previewTruncated,
    png_download_url: pngVariant?.object_name
      ? `${downloadUrl}?format=png`
      : null,
    png_filename: pngVariant?.filename ?? null,
    pdf_download_url: pdfVariant?.object_name
      ? `${downloadUrl}?format=pdf`
      : null,
    pdf_filename: pdfVariant?.filename ?? null,
  };
}
