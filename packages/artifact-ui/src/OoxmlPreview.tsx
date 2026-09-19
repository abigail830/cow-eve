import { useEffect, useRef, useState } from "react";

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

async function createScrollViewer(
  kind: OoxmlKind,
  container: HTMLElement,
): Promise<ScrollViewer> {
  const deskOptions = {
    background: "#f3f4f6",
    gap: 16,
    paddingTop: 16,
  };

  if (kind === "docx") {
    const { DocxScrollViewer } = await import("@silurus/ooxml/docx");
    return new DocxScrollViewer(container, deskOptions);
  }

  const { PptxScrollViewer } = await import("@silurus/ooxml/pptx");
  return new PptxScrollViewer(container, deskOptions);
}

export function OoxmlPreview({ kind, url, token, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let viewer: ScrollViewer | null = null;

    void (async () => {
      const container = containerRef.current;
      if (!container) return;

      try {
        const res = await fetch(url, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(await res.text());
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        viewer = await createScrollViewer(kind, container);
        await viewer.load(buffer);
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Preview failed");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [kind, url, token]);

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
