import path from "node:path";
import {
  artifactDownloadPath,
  artifactPreviewPath,
  type ArtifactFormat,
  type ArtifactKind,
  type ArtifactSpec,
} from "../../../../packages/artifact-spec/src/index.js";
import type { ChatArtifactFormat } from "../../domain/artifact/artifact.types.js";
import {
  newChatArtifactId,
  saveContentFile,
  saveSlideDeck,
} from "../../infrastructure/artifact/local-artifact.store.js";

const PREVIEW_CHAR_LIMIT = 120_000;

function formatForPath(sandboxPath: string): { kind: ArtifactKind; format: ArtifactFormat } {
  const suffix = path.posix.extname(sandboxPath).toLowerCase();
  if (suffix === ".docx") return { kind: "content_document", format: "docx" };
  if (suffix === ".pptx") return { kind: "content_document", format: "pptx" };
  if (suffix === ".html") return { kind: "slide_deck", format: "html" };
  if (suffix === ".md") return { kind: "content_document", format: "markdown" };
  return { kind: "content_document", format: "markdown" };
}

export async function buildContentStudioArtifactSpec(input: {
  chatId: string;
  sandboxPath: string;
  fileBytes: Uint8Array;
  title: string;
}): Promise<ArtifactSpec> {
  const filename = path.posix.basename(input.sandboxPath) || "deliverable";
  const { kind, format } = formatForPath(input.sandboxPath);
  const artifactId = newChatArtifactId("content");
  const cardTitle = input.title.trim() || filename;

  let previewContent = "";
  let previewTruncated = false;

  if (format === "html") {
    const htmlText = new TextDecoder().decode(input.fileBytes);
    await saveSlideDeck({
      chatId: input.chatId,
      artifactId,
      sourceText: htmlText,
      filename,
      distFiles: { "index.html": input.fileBytes },
      deckFormat: "html",
    });
    previewTruncated = htmlText.length > PREVIEW_CHAR_LIMIT;
    previewContent = previewTruncated ? "" : htmlText;
  } else {
    await saveContentFile({
      chatId: input.chatId,
      artifactId,
      data: input.fileBytes,
      filename,
      fileFormat: format as ChatArtifactFormat,
    });
    if (format === "markdown") {
      const mdText = new TextDecoder().decode(input.fileBytes);
      previewTruncated = mdText.length > PREVIEW_CHAR_LIMIT;
      previewContent = previewTruncated ? "" : mdText;
    }
  }

  const downloadUrl = artifactDownloadPath(input.chatId, artifactId);
  const previewUrl =
    kind === "slide_deck" || format === "markdown"
      ? artifactPreviewPath(input.chatId, artifactId)
      : null;

  return {
    kind,
    title: cardTitle,
    format,
    content: previewContent,
    filename,
    artifact_id: artifactId,
    download_url: downloadUrl,
    preview_url: previewUrl,
    preview_truncated: previewTruncated,
  };
}
