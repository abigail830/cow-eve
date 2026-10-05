import type { ReactNode } from "react";
import { generationToolResultSchema } from "./structuredDraftSchema";
import { StructuredDraftCard } from "./StructuredDraftCard";

export function resolveStructuredDraftToolPart(output: unknown): ReactNode | null {
  if (!output || typeof output !== "object") return null;
  const parsed = generationToolResultSchema.safeParse(output);
  if (!parsed.success || !parsed.data.draft) return null;
  const draft = parsed.data.draft;
  if (draft.status === "error") return null;
  if (draft.status === "needs_input" && draft.sections.length === 0) {
    return (
      <div className="structured-draft-card structured-draft-needs-input">
        <p>{draft.needsInput?.message ?? "More input required."}</p>
      </div>
    );
  }
  if (draft.sections.length === 0 && draft.status !== "degraded") return null;
  return <StructuredDraftCard draft={draft} />;
}
