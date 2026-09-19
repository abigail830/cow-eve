import type { ArtifactSpec } from "@fde/artifact-spec";
import { canPreviewArtifact } from "./artifactKinds";
import { PreviewDownloadActions } from "./ArtifactCardActions";
import { InlineArtifactCardShell } from "./InlineArtifactCardShell";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  onPreview?: (spec: ArtifactSpec) => void;
};

/** PowerPoint (.pptx) deliverable — slides cover, preview + download. */
export function PptArtifactCard({ spec, apiBase, token, onPreview }: Props) {
  const canDownload = Boolean(spec.download_url?.trim() || spec.content?.trim());

  return (
    <InlineArtifactCardShell
      spec={spec}
      coverKind="slides"
      cardClassName="ppt-artifact-card"
      actionsAriaLabel="PowerPoint actions"
      actions={
        <PreviewDownloadActions
          spec={spec}
          apiBase={apiBase}
          token={token}
          onPreview={onPreview}
          canPreview={canPreviewArtifact(spec)}
          canDownload={canDownload}
          previewLabel="Preview"
          downloadLabel="Download"
        />
      }
    />
  );
}
