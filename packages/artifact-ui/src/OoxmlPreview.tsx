import { useEffect, useRef, useState } from "react";
import { createOoxmlScrollViewer } from "./ooxml-runtime";

type OoxmlKind = "docx" | "pptx";

type ScrollViewer = {
  load: (source: string | ArrayBuffer) => Promise<void>;
  destroy: () => void;
};

type Props = {
  kind: OoxmlKind;
  url: string;
  token?: string | null;
  title: string;
};

async function fetchDocument(url: string, token?: string | null): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.arrayBuffer();
}

export function OoxmlPreview({ kind, url, token, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ScrollViewer | null>(null);
  const loadedUrlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loadedUrlRef.current === url && viewerRef.current) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const container = containerRef.current;
      if (!container) return;

      viewerRef.current?.destroy();
      viewerRef.current = null;
      loadedUrlRef.current = null;
      setLoading(true);
      setError(null);

      try {
        const [buffer, scrollViewer] = await Promise.all([
          fetchDocument(url, token),
          createOoxmlScrollViewer(kind, container),
        ]);
        if (cancelled) {
          scrollViewer.destroy();
          return;
        }

        await scrollViewer.load(buffer);
        if (cancelled) {
          scrollViewer.destroy();
          return;
        }

        viewerRef.current = scrollViewer;
        loadedUrlRef.current = url;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Preview failed");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, url, token]);

  useEffect(() => {
    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      loadedUrlRef.current = null;
    };
  }, []);

  return (
    <div className="artifact-ooxml-preview">
      {loading && !error ? (
        <p className="artifact-preview-status" aria-live="polite">
          Loading preview…
        </p>
      ) : null}
      {error ? <pre className="artifact-preview-markdown">{error}</pre> : null}
      <div
        ref={containerRef}
        className="artifact-ooxml-preview-host"
        aria-label={title}
        hidden={Boolean(error)}
      />
    </div>
  );
}
