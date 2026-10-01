import type { DocumentPreviewBundle } from "./documentPreviewKinds";

type PageRow = {
  page: number;
  lineStart?: number;
  lineEnd?: number;
  title?: string;
};

function collectPages(bundle: DocumentPreviewBundle): PageRow[] {
  const meta = bundle.parsed.meta;
  const pageindex = bundle.parsed.pageindex;
  const rows: PageRow[] = [];

  if (meta && Array.isArray(meta.pages)) {
    for (const item of meta.pages) {
      if (typeof item !== "object" || item === null) continue;
      const record = item as Record<string, unknown>;
      const page = Number(record.page ?? record.page_num ?? record.pageNum);
      if (!Number.isFinite(page) || page <= 0) continue;
      rows.push({
        page,
        lineStart:
          record.line_start != null ? Number(record.line_start) : undefined,
        lineEnd: record.line_end != null ? Number(record.line_end) : undefined,
        title:
          typeof record.title === "string" ? record.title : undefined,
      });
    }
  }

  if (rows.length === 0 && pageindex && Array.isArray(pageindex.layouts)) {
    const seen = new Set<number>();
    for (const layout of pageindex.layouts) {
      if (typeof layout !== "object" || layout === null) continue;
      const record = layout as Record<string, unknown>;
      const page = Number(
        record.pageNum ??
          record.page_num ??
          record.pageIndex ??
          record.page_number,
      );
      if (!Number.isFinite(page) || page <= 0 || seen.has(page)) continue;
      seen.add(page);
      rows.push({ page });
    }
    rows.sort((a, b) => a.page - b.page);
  }

  return rows;
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

type Props = {
  bundle: DocumentPreviewBundle;
};

export function DocumentPageIndexPreview({ bundle }: Props) {
  const pages = collectPages(bundle);
  const meta = bundle.parsed.meta;
  const pageindex = bundle.parsed.pageindex;

  if (!pages.length && !pageindex && !meta) {
    return (
      <p className="document-preview-status">
        No page index yet. Parsing may still be in progress.
      </p>
    );
  }

  return (
    <div className="document-preview-pageindex">
      {meta ? (
        <section className="document-preview-meta-summary">
          <h4>Document stats</h4>
          <ul>
            {meta.page_count != null ? (
              <li>Pages: {String(meta.page_count)}</li>
            ) : null}
            {meta.line_count != null ? (
              <li>Lines: {String(meta.line_count)}</li>
            ) : null}
            {Array.isArray(meta.figures) ? (
              <li>Figures: {meta.figures.length}</li>
            ) : null}
            {Array.isArray(meta.warnings) && meta.warnings.length > 0 ? (
              <li>Parse warnings: {meta.warnings.length}</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {pages.length > 0 ? (
        <section>
          <h4>Pages</h4>
          <ol className="document-preview-page-list">
            {pages.map((row) => (
              <li key={row.page}>
                <span className="document-preview-page-num">Page {row.page}</span>
                {row.lineStart != null && row.lineEnd != null ? (
                  <span className="document-preview-muted">
                    {" "}
                    · lines {row.lineStart}–{row.lineEnd}
                  </span>
                ) : null}
                {row.title ? (
                  <span className="document-preview-page-title"> — {row.title}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {Array.isArray(meta?.sections) && meta.sections.length > 0 ? (
        <section>
          <h4>Sections</h4>
          <ul className="document-preview-section-list">
            {(meta.sections as unknown[]).slice(0, 24).map((section, index) => {
              if (typeof section !== "object" || section === null) return null;
              const title = String((section as { title?: string }).title ?? "").trim();
              if (!title) return null;
              return <li key={`${title}-${index}`}>{title}</li>;
            })}
          </ul>
        </section>
      ) : null}

      {pageindex ? (
        <details className="document-preview-json-details">
          <summary>Raw pageindex.json</summary>
          <pre>{prettyJson(pageindex)}</pre>
        </details>
      ) : null}

      {meta ? (
        <details className="document-preview-json-details">
          <summary>Raw meta.json</summary>
          <pre>{prettyJson(meta)}</pre>
        </details>
      ) : null}
    </div>
  );
}
