import { useCallback, useState } from "react";
import type {
  StructuredDraftEnvelope,
  StructuredDraftSection,
} from "./structuredDraftSchema";

export type { StructuredDraftSection };

type Props = {
  draft: StructuredDraftEnvelope;
};

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function StructuredDraftCard({ draft }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const onCopy = useCallback(async (sectionId: string, text: string) => {
    await copyText(text);
    setCopiedId(sectionId);
    window.setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const banner =
    draft.status === "degraded"
      ? "Some fields could not be parsed. Review carefully before use."
      : draft.status === "needs_input"
        ? draft.needsInput?.message ?? "More input required."
        : null;

  return (
    <div className="structured-draft-card" role="region" aria-label={draft.title}>
      <p className="structured-draft-disclaimer">{draft.disclaimer}</p>
      <h3 className="structured-draft-title">{draft.title}</h3>
      {banner ? <p className="structured-draft-banner">{banner}</p> : null}
      {draft.sections.map((section: StructuredDraftSection) => {
        const body =
          section.items && section.items.length > 0
            ? section.items.map((item: string) => `• ${item}`).join("\n")
            : section.body;
        return (
          <div key={section.id} className="structured-draft-section">
            <div className="structured-draft-section-head">
              <strong>{section.label}</strong>
              {body.trim() ? (
                <button
                  type="button"
                  className="structured-draft-copy"
                  onClick={() => void onCopy(section.id, body)}
                >
                  {copiedId === section.id ? "Copied" : "Copy"}
                </button>
              ) : null}
            </div>
            {section.flags?.includes("verify") ? (
              <span className="structured-draft-flag">Verify</span>
            ) : null}
            <div className="structured-draft-body">{body.trim() || "—"}</div>
            {section.citations?.length ? (
              <ul className="structured-draft-citations" aria-label="Source excerpts">
                {section.citations.map((c, i) => (
                  <li key={`${section.id}-cite-${i}`}>
                    {c.filename ? (
                      <span className="structured-draft-cite-file">{c.filename}: </span>
                    ) : null}
                    {c.excerpt ?? ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
      {draft.rawExcerpt ? (
        <details className="structured-draft-raw">
          <summary>Raw model output</summary>
          <pre>{draft.rawExcerpt}</pre>
        </details>
      ) : null}
    </div>
  );
}
