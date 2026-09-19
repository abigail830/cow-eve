import type { ArtifactSpec } from "@fde/artifact-spec";
import { canPreviewArtifact } from "./artifactKinds";
import { PreviewDownloadActions } from "./ArtifactCardActions";
import { resolveArtifactCoverKind } from "./ArtifactCoverIllustration";
import { InlineArtifactCardShell } from "./InlineArtifactCardShell";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  onPreview?: (spec: ArtifactSpec) => void;
};

/** Generic content_document fallback (pdf, etc.). */
export function ContentDocumentArtifactCard({ spec, apiBase, token, onPreview }: Props) {
  const canDownload = Boolean(spec.download_url?.trim() || spec.content?.trim());
  const canPreview = canPreviewArtifact(spec);

  return (
    <InlineArtifactCardShell
      spec={spec}
      coverKind={resolveArtifactCoverKind(spec)}
      cardClassName="inline-download-artifact-card"
      actionsAriaLabel="Artifact actions"
      actions={
        <PreviewDownloadActions
          spec={spec}
          apiBase={apiBase}
          token={token}
          onPreview={onPreview}
          canPreview={canPreview}
          canDownload={canDownload}
        />
      }
    />
  );
}
