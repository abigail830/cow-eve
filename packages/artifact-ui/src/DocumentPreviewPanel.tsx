import { useEffect, useMemo, useState } from "react";
import { DocumentOriginalPreview } from "./DocumentOriginalPreview";
import { DocumentPageIndexPreview } from "./DocumentPageIndexPreview";
import { ParsedDocumentMarkdownPreview } from "./ParsedDocumentMarkdownPreview";
import { ParsedFigureGallery } from "./ParsedFigureGallery";
import type { DocumentPreviewBundle } from "./documentPreviewKinds";

export type DocumentPreviewTab = "original" | "parsed" | "pageindex";
export type ParsedMarkdownView = "rendered" | "source";

type Props = {
  bundle: DocumentPreviewBundle;
  originalDownloadUrl: string;
  token?: string | null;
  resolveFigureUrl: (figureRef: string) => string;
  className?: string;
};

function parseStatusMessage(bundle: DocumentPreviewBundle): string | null {
  const status = bundle.file.parseStatus;
  if (status === "pending" || status === "running") {
    return "Parse in progress. Parsed markdown and page index will appear when ready.";
  }
  if (status === "failed") {
    return bundle.file.parseErrorMessage ?? "Parse failed.";
  }
  if (status === "skipped") {
    return "Parse was skipped for this file.";
  }
  return null;
}

export function DocumentPreviewPanel({
  bundle,
  originalDownloadUrl,
  token,
  resolveFigureUrl,
  className = "",
}: Props) {
  const hasParsed = Boolean(
    bundle.parsed.markdown ?? bundle.parsed.markdownRaw,
  );

  const defaultTab = useMemo((): DocumentPreviewTab => {
    if (bundle.file.kind === "image" || bundle.file.kind === "pdf") {
      return "original";
    }
    if (hasParsed) return "parsed";
    return "original";
  }, [bundle.file.kind, hasParsed]);

  const [tab, setTab] = useState<DocumentPreviewTab>(defaultTab);
  const [parsedView, setParsedView] = useState<ParsedMarkdownView>("rendered");
  const statusMessage = parseStatusMessage(bundle);

  useEffect(() => {
    setTab(defaultTab);
  }, [bundle.file.id, defaultTab]);

  useEffect(() => {
    setParsedView("rendered");
  }, [bundle.file.id]);

  const renderedMarkdown =
    bundle.parsed.markdown ?? bundle.parsed.markdownRaw ?? "";
  const sourceMarkdown =
    bundle.parsed.markdownRaw ?? bundle.parsed.markdown ?? "";

  return (
    <div className={`document-preview-panel ${className}`.trim()}>
      <div className="document-preview-tabs" role="tablist" aria-label="Preview mode">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "original"}
          className={tab === "original" ? "active" : ""}
          onClick={() => setTab("original")}
        >
          Original
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "parsed"}
          className={tab === "parsed" ? "active" : ""}
          onClick={() => setTab("parsed")}
        >
          Parsed
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pageindex"}
          className={tab === "pageindex" ? "active" : ""}
          onClick={() => setTab("pageindex")}
        >
          Page index
        </button>
      </div>

      <div className="document-preview-tab-body">
        {tab === "original" ? (
          <DocumentOriginalPreview
            bundle={bundle}
            downloadUrl={originalDownloadUrl}
            token={token}
          />
        ) : null}

        {tab === "parsed" ? (
          hasParsed ? (
            <div className="document-preview-parsed">
              <div
                className="document-preview-subtabs"
                role="tablist"
                aria-label="Parsed markdown view"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={parsedView === "rendered"}
                  className={parsedView === "rendered" ? "active" : ""}
                  onClick={() => setParsedView("rendered")}
                >
                  Rendered
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={parsedView === "source"}
                  className={parsedView === "source" ? "active" : ""}
                  onClick={() => setParsedView("source")}
                >
                  Source
                </button>
              </div>
              {parsedView === "rendered" ? (
                <>
                  <ParsedDocumentMarkdownPreview
                    markdown={renderedMarkdown}
                    token={token}
                    resolveFigureUrl={resolveFigureUrl}
                    className="document-preview-markdown"
                  />
                  <ParsedFigureGallery
                    meta={bundle.parsed.meta}
                    token={token}
                    resolveFigureUrl={resolveFigureUrl}
                  />
                </>
              ) : (
                <pre className="document-preview-source-md">{sourceMarkdown}</pre>
              )}
            </div>
          ) : (
            <p className="document-preview-status">
              {statusMessage ?? "Parsed markdown is not available yet."}
            </p>
          )
        ) : null}

        {tab === "pageindex" ? <DocumentPageIndexPreview bundle={bundle} /> : null}
      </div>
    </div>
  );
}
