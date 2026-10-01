/** Rewrite parsed document markdown image refs for UI preview (figure:fN + bare filenames). */

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

export type ParsedFigureMeta = {
  id: string;
  filename: string | null;
  line: number | null;
};

const STANDALONE_IMAGE_LINE =
  /^\s*(?:!\[[^\]]*\]\(\s*)?([a-zA-Z0-9._-]+\.(?:jpe?g|png|webp|gif))(?:\s*\))?\s*$/i;

const HTML_IMG_TAG =
  /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi;

export function parseFigureMetaList(
  meta: Record<string, unknown> | null | undefined,
): ParsedFigureMeta[] {
  const raw = meta?.figures;
  if (!Array.isArray(raw)) return [];
  const out: ParsedFigureMeta[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = String(record.id ?? "").trim();
    if (!id) continue;
    const filename =
      typeof record.filename === "string" && record.filename.trim()
        ? record.filename.trim()
        : null;
    const lineRaw = record.line;
    const line =
      typeof lineRaw === "number" && Number.isFinite(lineRaw)
        ? lineRaw
        : typeof lineRaw === "string" && lineRaw.trim()
          ? Number.parseInt(lineRaw, 10)
          : null;
    out.push({
      id,
      filename,
      line: line != null && Number.isFinite(line) ? line : null,
    });
  }
  return out;
}

export function imageRefSegment(ref: string): string {
  const trimmed = ref.trim();
  const withoutScheme = trimmed.replace(/^figure:/i, "");
  const noQuery = withoutScheme.split("?")[0]?.split("#")[0] ?? withoutScheme;
  const slash = noQuery.lastIndexOf("/");
  return slash >= 0 ? noQuery.slice(slash + 1) : noQuery;
}

export function normalizeFigureIdFromRef(ref: string): string {
  return imageRefSegment(ref).replace(/\.[^.]+$/, "");
}

/** Try several stored figure ids for one markdown image ref. */
export function figureIdCandidates(
  ref: string,
  meta: Record<string, unknown> | null | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (id: string) => {
    const key = id.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };

  const segment = imageRefSegment(ref);
  add(normalizeFigureIdFromRef(ref));
  if (segment !== normalizeFigureIdFromRef(ref)) add(segment.replace(/\.[^.]+$/, ""));

  for (const fig of parseFigureMetaList(meta)) {
    if (!fig.filename) continue;
    if (
      fig.filename === segment ||
      fig.filename === ref.trim() ||
      fig.filename.endsWith(`/${segment}`)
    ) {
      add(fig.id);
    }
    if (`${fig.id}.jpeg` === segment || `${fig.id}.jpg` === segment) {
      add(fig.id);
    }
    if (`${fig.id}.png` === segment || `${fig.id}.webp` === segment) {
      add(fig.id);
    }
  }

  return out;
}

function resolveFigureId(url: string, figures: ParsedFigureMeta[]): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  if (/^https?:\/\//i.test(trimmed)) return null;
  if (trimmed.startsWith("figure:")) {
    const id = normalizeFigureIdFromRef(trimmed);
    return id || null;
  }

  const noQuery = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
  const segment =
    noQuery.lastIndexOf("/") >= 0
      ? noQuery.slice(noQuery.lastIndexOf("/") + 1)
      : noQuery;

  for (const fig of figures) {
    if (fig.filename && (fig.filename === segment || fig.filename === noQuery)) {
      return fig.id;
    }
    if (`${fig.id}.jpeg` === segment || `${fig.id}.jpg` === segment) {
      return fig.id;
    }
    if (`${fig.id}.png` === segment || `${fig.id}.webp` === segment) {
      return fig.id;
    }
  }

  if (/\.(jpe?g|png|webp|gif)$/i.test(segment)) {
    const candidate = normalizeFigureIdFromRef(segment);
    if (figures.some((f) => f.id === candidate)) return candidate;
    return candidate || null;
  }

  return null;
}

/** Normalize image targets to `figure:{id}` so clients can resolve authenticated figure URLs. */
export function rewriteParsedMarkdownFigureRefs(
  markdown: string,
  meta: Record<string, unknown> | null | undefined,
): string {
  const figures = parseFigureMetaList(meta);
  return markdown.replace(MARKDOWN_IMAGE_RE, (full, alt: string, url: string) => {
    const figureId = resolveFigureId(url, figures);
    if (!figureId) return full;
    return `![${alt}](figure:${figureId})`;
  });
}

function pickFigureForSegment(input: {
  lineNumber: number;
  segment: string;
  figures: ParsedFigureMeta[];
  used: Set<string>;
  pool: ParsedFigureMeta[];
  poolCursor: { value: number };
}): ParsedFigureMeta | null {
  const { lineNumber, segment, figures, used, pool, poolCursor } = input;
  const stem = normalizeFigureIdFromRef(segment);

  for (const fig of figures) {
    if (used.has(fig.id)) continue;
    if (fig.line === lineNumber) return fig;
  }
  for (const fig of figures) {
    if (used.has(fig.id)) continue;
    if (fig.filename === segment || fig.id === stem) return fig;
    if (fig.filename && normalizeFigureIdFromRef(fig.filename) === stem) return fig;
  }
  while (poolCursor.value < pool.length) {
    const fig = pool[poolCursor.value];
    poolCursor.value += 1;
    if (!used.has(fig.id)) return fig;
  }
  return null;
}

/** PDF parsers often emit bare filenames on their own line — turn them into markdown images. */
export function hydrateLooseFigureLines(
  markdown: string,
  meta: Record<string, unknown> | null | undefined,
): string {
  const figures = parseFigureMetaList(meta);
  if (!figures.length) return markdown;

  const used = new Set<string>();
  for (const fig of figures) {
    if (markdown.includes(`figure:${fig.id}`)) used.add(fig.id);
  }

  const pool = figures.filter((f) => !used.has(f.id));
  const poolCursor = { value: 0 };

  const lines = markdown.split("\n");
  const next = lines.map((line, index) => {
    const lineNumber = index + 1;
    if (line.includes("figure:")) return line;

    const htmlMatch = line.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
    const standalone = line.match(STANDALONE_IMAGE_LINE);
    const segment = htmlMatch?.[1] ?? standalone?.[1];
    if (!segment) return line;

    const fig = pickFigureForSegment({
      lineNumber,
      segment: imageRefSegment(segment),
      figures,
      used,
      pool,
      poolCursor,
    });
    if (!fig) return line;

    used.add(fig.id);
    const alt = fig.filename ?? fig.id;
    return `![${alt}](figure:${fig.id})`;
  });

  return next.join("\n");
}

export function rewriteHtmlImgTagsToFigureRefs(
  markdown: string,
  meta: Record<string, unknown> | null | undefined,
): string {
  const figures = parseFigureMetaList(meta);
  return markdown.replace(HTML_IMG_TAG, (full, src: string) => {
    const figureId = resolveFigureId(src, figures);
    if (!figureId) return full;
    return `![figure](figure:${figureId})`;
  });
}

/** Ensure every meta figure appears at least once as a markdown image (preview gallery). */
export function appendUnreferencedFiguresToMarkdown(
  markdown: string,
  meta: Record<string, unknown> | null | undefined,
): string {
  const figures = parseFigureMetaList(meta);
  if (!figures.length) return markdown;

  const missing = figures.filter((fig) => !markdown.includes(`figure:${fig.id}`));
  if (!missing.length) return markdown;

  const blocks = missing.map(
    (fig) => `![${fig.filename ?? fig.id}](figure:${fig.id})`,
  );
  return `${markdown.trimEnd()}\n\n## Extracted figures\n\n${blocks.join("\n\n")}\n`;
}

/** Full preview pipeline for parsed markdown (standard refs + PDF loose filenames). */
export function hydrateParsedMarkdownForPreview(
  markdown: string,
  meta: Record<string, unknown> | null | undefined,
): string {
  let out = rewriteHtmlImgTagsToFigureRefs(markdown, meta);
  out = rewriteParsedMarkdownFigureRefs(out, meta);
  out = hydrateLooseFigureLines(out, meta);
  return out;
}
