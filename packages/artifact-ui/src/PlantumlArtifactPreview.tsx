import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const KROKI_PLANTUML_SVG = "https://kroki.io/plantuml/svg";

type Tab = "diagram" | "source";

type Props = {
  source: string;
};

export function PlantumlArtifactPreview({ source }: Props) {
  const [tab, setTab] = useState<Tab>("diagram");
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
      <div className="artifact-plantuml-tabs" role="tablist" aria-label="PlantUML preview">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "diagram"}
          className={tab === "diagram" ? "active" : ""}
          onClick={() => setTab("diagram")}
        >
          Diagram
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "source"}
          className={tab === "source" ? "active" : ""}
          onClick={() => setTab("source")}
        >
          Source
        </button>
      </div>

      <div className="artifact-plantuml-tab-body">
        {tab === "diagram" ? (
          <div className="artifact-plantuml-diagram-pane">
            {rendering ? (
              <div className="artifact-plantuml-center-status" role="status">
                <Loader2 size={22} className="artifact-spin" aria-hidden />
                <span>Rendering diagram…</span>
              </div>
            ) : null}
            {!rendering && svgUrl ? (
              <img
                className="artifact-plantuml-diagram"
                src={svgUrl}
                alt="PlantUML diagram"
              />
            ) : null}
            {!rendering && renderError ? (
              <div className="artifact-plantuml-center-status">
                <p className="artifact-preview-status">
                  Diagram preview unavailable ({renderError}). Open the Source tab
                  to view or copy the `.puml` file.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <pre className="artifact-plantuml-source artifact-plantuml-source-tab">
            {source}
          </pre>
        )}
      </div>
    </div>
  );
}
