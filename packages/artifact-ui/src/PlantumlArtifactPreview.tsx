import { useEffect, useState } from "react";

const KROKI_PLANTUML_SVG = "https://kroki.io/plantuml/svg";

type Props = {
  source: string;
};

export function PlantumlArtifactPreview({ source }: Props) {
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    const controller = new AbortController();
    setRendering(true);
    setRenderError(null);
    setSvgUrl(null);

    void (async () => {
      try {
        const res = await fetch(KROKI_PLANTUML_SVG, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: source,
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setSvgUrl(objectUrl);
      } catch (err) {
        if (controller.signal.aborted) return;
        setRenderError(
          err instanceof Error ? err.message : "Could not render diagram",
        );
      } finally {
        if (!controller.signal.aborted) setRendering(false);
      }
    })();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  return (
    <div className="artifact-plantuml-preview">
      {rendering ? (
        <p className="artifact-preview-status">Rendering diagram…</p>
      ) : null}
      {svgUrl ? (
        <img
          className="artifact-plantuml-diagram"
          src={svgUrl}
          alt="PlantUML diagram"
        />
      ) : null}
      {renderError ? (
        <p className="artifact-preview-status">
          Diagram preview unavailable ({renderError}). Showing source.
        </p>
      ) : null}
      <pre className="artifact-plantuml-source">{source}</pre>
    </div>
  );
}
