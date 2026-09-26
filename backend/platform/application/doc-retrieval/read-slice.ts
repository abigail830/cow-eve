const READ_MAX_LINES = 2000;
const READ_MAX_BYTES = 128 * 1024;

function lineBounds(
  meta: Record<string, unknown>,
  input: { page?: number | null; sectionId?: string | null },
): [number, number] | null {
  if (input.sectionId) {
    const sections = meta.sections;
    if (!Array.isArray(sections)) return null;
    for (const section of sections) {
      if (!section || typeof section !== "object") continue;
      const record = section as Record<string, unknown>;
      if (String(record.id ?? "") === input.sectionId) {
        const start = Number(record.line_start ?? 1);
        const end = Number(record.line_end ?? start);
        return [start, end];
      }
    }
    return null;
  }
  if (input.page != null) {
    const pages = meta.pages;
    if (!Array.isArray(pages)) return null;
    for (const pageEntry of pages) {
      if (!pageEntry || typeof pageEntry !== "object") continue;
      const record = pageEntry as Record<string, unknown>;
      if (Number(record.page ?? 0) === input.page) {
        const start = Number(record.line_start ?? 1);
        const end = Number(record.line_end ?? start);
        return [start, end];
      }
    }
    return null;
  }
  return null;
}

export function readContentSlice(
  content: string,
  meta: Record<string, unknown>,
  input: {
    lineStart?: number | null;
    lineEnd?: number | null;
    page?: number | null;
    sectionId?: string | null;
    maxLines?: number;
    maxBytes?: number;
  } = {},
): Record<string, unknown> {
  const lines = content.split("\n");
  const totalLines = lines.length;
  let lineStart = input.lineStart ?? null;
  let lineEnd = input.lineEnd ?? null;
  const bounds = lineBounds(meta, {
    page: input.page,
    sectionId: input.sectionId,
  });
  if (bounds) {
    lineStart = bounds[0];
    lineEnd = bounds[1];
  }
  const start = Math.max(1, lineStart ?? 1);
  let end = Math.max(start, lineEnd ?? (totalLines || 1));
  if (totalLines) end = Math.min(end, totalLines);

  let selected = lines.slice(start - 1, end);
  const maxLines = input.maxLines ?? READ_MAX_LINES;
  let truncatedByLines = false;
  if (selected.length > maxLines) {
    selected = selected.slice(0, maxLines);
    truncatedByLines = true;
    end = start + maxLines - 1;
  }

  let text = selected.join("\n");
  const maxBytes = input.maxBytes ?? READ_MAX_BYTES;
  let truncatedByBytes = false;
  const encoded = new TextEncoder().encode(text);
  if (encoded.byteLength > maxBytes) {
    text = new TextDecoder().decode(encoded.slice(0, maxBytes));
    truncatedByBytes = true;
  }

  return {
    line_start: start,
    line_end: end,
    line_count: selected.length,
    total_lines: totalLines,
    content: text,
    truncated: truncatedByLines || truncatedByBytes,
    page: input.page ?? null,
    section_id: input.sectionId ?? null,
  };
}
