export type DocumentPreviewKind =
  | "image"
  | "pdf"
  | "sheet"
  | "text"
  | "office"
  | "audio";

export type DocumentPreviewBundle = {
  file: {
    id: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    parseStatus: string;
    parseErrorMessage: string | null;
    kind: DocumentPreviewKind;
  };
  parsed: {
    markdown: string | null;
    markdownRaw: string | null;
    meta: Record<string, unknown> | null;
    pageindex: Record<string, unknown> | null;
  };
};

export type ParsedFigureListItem = {
  id: string;
  filename: string | null;
};

export function listFiguresFromMeta(
  meta: Record<string, unknown> | null | undefined,
): ParsedFigureListItem[] {
  const raw = meta?.figures;
  if (!Array.isArray(raw)) return [];
  const out: ParsedFigureListItem[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = String(record.id ?? "").trim();
    if (!id) continue;
    const filename =
      typeof record.filename === "string" && record.filename.trim()
        ? record.filename.trim()
        : null;
    out.push({ id, filename });
  }
  return out;
}

export function classifyDocumentPreviewKind(input: {
  filename: string;
  mediaType: string;
}): DocumentPreviewKind {
  const name = input.filename.toLowerCase();
  const mime = (input.mediaType || "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (/\.(ppt|pptx)$/.test(name) || mime.includes("presentation")) return "office";
  if (/\.(doc|docx)$/.test(name) || mime.includes("wordprocessing")) return "office";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/.test(name)) return "image";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime.includes("spreadsheet") ||
    mime === "text/csv" ||
    /\.(xls|xlsx|csv)$/.test(name)
  ) {
    return "sheet";
  }
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|flac|aac|ogg|opus|webm)$/.test(name)) {
    return "audio";
  }
  return "text";
}

export function officePreviewKind(input: {
  filename: string;
  mediaType: string;
}): "docx" | "pptx" {
  const name = input.filename.toLowerCase();
  const mime = input.mediaType.toLowerCase();
  if (/\.(ppt|pptx)$/.test(name) || mime.includes("presentation")) return "pptx";
  return "docx";
}

export function isTextLikeOriginal(kind: DocumentPreviewKind): boolean {
  return kind === "text" || kind === "sheet";
}
