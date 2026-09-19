import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ArtifactSpec } from "@fde/artifact-spec";
import { isMarkdownPreviewable } from "./artifactKinds";
import { resolveArtifactUrl } from "./api";

type Props = {
  spec: ArtifactSpec | null;
  apiBase: string;
  token?: string | null;
  onClose: () => void;
};

/** reveal.js and similar decks call history.replaceState; blob: iframes reject that. */
const HISTORY_GUARD = `<script>(function(){try{var n=function(){};history.pushState=n;history.replaceState=n;}catch(e){}})();</script>`;

function withHistoryGuard(html: string): string {
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${HISTORY_GUARD}`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${HISTORY_GUARD}</head>`);
  }
  return `${HISTORY_GUARD}${html}`;
}

function PreviewFrame({
  url,
  token,
  title,
}: {
  url: string;
  token?: string | null;
  title: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const res = await fetch(url, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(await res.text());
        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        const blob = await res.blob();
        const isHtml =
          contentType.includes("text/html") ||
          blob.type.includes("text/html") ||
          /\.html?(?:\?|$)/i.test(url);

        if (isHtml) {
          const html = withHistoryGuard(await blob.text());
          objectUrl = URL.createObjectURL(
            new Blob([html], { type: "text/html;charset=utf-8" }),
          );
        } else {
          objectUrl = URL.createObjectURL(blob);
        }
        if (!cancelled) setSrc(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Preview failed");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, token]);

  if (error) return <pre className="artifact-preview-markdown">{error}</pre>;
  if (!src) return <pre className="artifact-preview-markdown">Loading preview…</pre>;
  // allow-scripts only: pairing with allow-same-origin lets pages escape the sandbox
  // and also surfaces Chrome's security warning. Self-contained HTML slides don't need it.
  return <iframe title={title} src={src} sandbox="allow-scripts" />;
}

export function ArtifactPreviewModal({ spec, apiBase, token, onClose }: Props) {
  if (!spec) return null;

  const previewUrl = resolveArtifactUrl(spec.preview_url, apiBase);

  return (
    <div className="artifact-preview-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="artifact-preview-modal"
        role="dialog"
        aria-label={spec.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="artifact-preview-modal-header">
          <strong>{spec.title}</strong>
          <button type="button" className="artifact-inline-action-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="artifact-preview-modal-body">
          {isMarkdownPreviewable(spec) && spec.content ? (
            <pre className="artifact-preview-markdown">{spec.content}</pre>
          ) : spec.kind === "diagram_svg" && spec.content ? (
            <div
              className="artifact-preview-markdown"
              dangerouslySetInnerHTML={{ __html: spec.content }}
            />
          ) : previewUrl ? (
            <PreviewFrame url={previewUrl} token={token} title={spec.title} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
