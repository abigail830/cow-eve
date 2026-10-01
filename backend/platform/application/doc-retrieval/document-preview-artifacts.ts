import { loadParsedArtifact } from "../../infrastructure/attachment/parsed-artifact-storage.js";
import { hydrateParsedMarkdownForPreview } from "./parsed-markdown-figures.js";

const MAX_MARKDOWN_CHARS = 120_000;
const MAX_JSON_CHARS = 200_000;

function decodeUtf8(raw: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(raw);
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n…`;
}

function parseJsonObject(raw: Uint8Array | null): Record<string, unknown> | null {
  if (!raw?.byteLength) return null;
  const text = truncateText(decodeUtf8(raw), MAX_JSON_CHARS);
  try {
    const value = JSON.parse(text) as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export type DocumentPreviewArtifacts = {
  /** Hydrated for UI preview (figure refs + gallery). */
  markdown: string | null;
  /** Raw content.md from parse pipeline. */
  markdownRaw: string | null;
  meta: Record<string, unknown> | null;
  pageindex: Record<string, unknown> | null;
};

export async function loadDocumentPreviewArtifacts(input: {
  scopeId: string;
  documentId: string;
}): Promise<DocumentPreviewArtifacts> {
  const [mdRaw, metaRaw, pageRaw] = await Promise.all([
    loadParsedArtifact(input.scopeId, input.documentId, "content_md"),
    loadParsedArtifact(input.scopeId, input.documentId, "meta_json"),
    loadParsedArtifact(input.scopeId, input.documentId, "pageindex_json"),
  ]);

  const meta = parseJsonObject(metaRaw);
  let markdownRaw: string | null = null;
  let markdown: string | null = null;
  if (mdRaw?.byteLength) {
    markdownRaw = truncateText(decodeUtf8(mdRaw), MAX_MARKDOWN_CHARS);
    markdown = hydrateParsedMarkdownForPreview(markdownRaw, meta);
  }

  return {
    markdown,
    markdownRaw,
    meta,
    pageindex: parseJsonObject(pageRaw),
  };
}
