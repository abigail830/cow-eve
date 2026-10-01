import {
  loadParsedArtifact,
  loadParsedFigure,
} from "../../infrastructure/attachment/parsed-artifact-storage.js";
import { figureIdCandidates } from "./parsed-markdown-figures.js";

const EXTENSIONS = ["jpeg", "jpg", "png", "webp", "gif"] as const;

function mimeForExtension(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

async function loadMetaForDocument(
  scopeId: string,
  documentId: string,
): Promise<Record<string, unknown> | null> {
  const raw = await loadParsedArtifact(scopeId, documentId, "meta_json");
  if (!raw?.byteLength) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(raw)) as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function loadParsedFigureBytes(input: {
  scopeId: string;
  documentId: string;
  figureRef: string;
  meta?: Record<string, unknown> | null;
}): Promise<{ data: Uint8Array; mediaType: string } | null> {
  const meta =
    input.meta !== undefined
      ? input.meta
      : await loadMetaForDocument(input.scopeId, input.documentId);
  const ids = figureIdCandidates(input.figureRef, meta);
  if (!ids.length) return null;

  for (const figureId of ids) {
    for (const extension of EXTENSIONS) {
      const ext = extension === "jpg" ? "jpeg" : extension;
      const bytes = await loadParsedFigure(
        input.scopeId,
        input.documentId,
        figureId,
        ext,
      );
      if (bytes?.byteLength) {
        return { data: bytes, mediaType: mimeForExtension(ext) };
      }
    }
  }
  return null;
}
