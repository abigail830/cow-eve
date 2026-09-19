import type { ArtifactSpec } from "@fde/artifact-spec";
import { DiagramCardActions } from "./ArtifactCardActions";
import { InlineArtifactCardShell } from "./InlineArtifactCardShell";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  chatId?: string | null;
  compactActions?: boolean;
  onPreview?: (spec: ArtifactSpec) => void;
};

/** Diagram (SVG/PNG) — flowchart cover, preview + SVG/PNG download. */
export function DiagramArtifactCard({
  spec,
  apiBase,
  token,
  chatId,
  compactActions,
  onPreview,
}: Props) {
  return (
    <InlineArtifactCardShell
      spec={spec}
      coverKind="diagram"
      cardClassName="diagram-artifact-card"
      actionsAriaLabel="Diagram actions"
      actions={
        <DiagramCardActions
          spec={spec}
          apiBase={apiBase}
          token={token}
          chatId={chatId}
          compact={compactActions}
          onPreview={onPreview}
        />
      }
    />
  );
}
