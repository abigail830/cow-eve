import { DocRetrievalError } from "./chat-library.js";
import { loadParsedFigure } from "../../infrastructure/attachment/parsed-artifact-storage.js";

const FIGURE_MAX_BYTES = 4 * 1024 * 1024;

function normalizeFigureId(figureId: string): string {
  const trimmed = figureId.trim();
  if (!trimmed) throw new DocRetrievalError("invalid", "figure_id required");
  return trimmed.replace(/^figure:/i, "");
}

export async function readFigurePayload(input: {
  chatId: string;
  attachmentId: string;
  figureId: string;
  meta: Record<string, unknown>;
}): Promise<{
  figure_id: string;
  alt: string | null;
  mime_type: string;
  size_bytes: number;
  image_base64: string;
  data_url: string;
}> {
  const figureId = normalizeFigureId(input.figureId);
  const figures = input.meta.figures;
  if (!Array.isArray(figures)) {
    throw new DocRetrievalError("figure_not_found", `figure not in meta: ${figureId}`);
  }

  let figureMeta: Record<string, unknown> | null = null;
  for (const fig of figures) {
    if (typeof fig === "object" && fig !== null) {
      const record = fig as Record<string, unknown>;
      if (String(record.id ?? "") === figureId) {
        figureMeta = record;
        break;
      }
    }
  }
  if (!figureMeta) {
    throw new DocRetrievalError("figure_not_found", `figure not found: ${figureId}`);
  }

  const filename = String(figureMeta.filename ?? `${figureId}.jpeg`);
  const extension =
    filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "jpeg";
  const mimeType =
    typeof figureMeta.mime_type === "string"
      ? figureMeta.mime_type
      : extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : "image/jpeg";

  const data = await loadParsedFigure(
    input.chatId,
    input.attachmentId,
    figureId,
    extension,
  );
  if (!data?.byteLength) {
    throw new DocRetrievalError("figure_not_found", `figure bytes missing: ${figureId}`);
  }
  if (data.byteLength > FIGURE_MAX_BYTES) {
    throw new DocRetrievalError(
      "figure_too_large",
      `figure exceeds ${FIGURE_MAX_BYTES} bytes`,
    );
  }

  const encoded = Buffer.from(data).toString("base64");
  return {
    figure_id: figureId,
    alt: typeof figureMeta.alt === "string" ? figureMeta.alt : null,
    mime_type: mimeType,
    size_bytes: data.byteLength,
    image_base64: encoded,
    data_url: `data:${mimeType};base64,${encoded}`,
  };
}
