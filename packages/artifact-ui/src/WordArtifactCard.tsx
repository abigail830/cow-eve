import type { ArtifactSpec } from "@fde/artifact-spec";
import { canPreviewArtifact } from "./artifactKinds";
import { PreviewDownloadActions } from "./ArtifactCardActions";
import { InlineArtifactCardShell } from "./InlineArtifactCardShell";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  chatId?: string | null;
  compactActions?: boolean;
  onPreview?: (spec: ArtifactSpec) => void;
};

/** Word (.docx) deliverable — document cover, preview + download. */
export function WordArtifactCard({
  spec,
  apiBase,
  token,
  chatId,
  compactActions,
  onPreview,
}: Props) {
  const canDownload = Boolean(spec.download_url?.trim() || spec.content?.trim());

  return (
    <InlineArtifactCardShell
      spec={spec}
      coverKind="word"
      cardClassName="word-artifact-card"
      actionsAriaLabel="Word document actions"
      actions={
        <PreviewDownloadActions
          spec={spec}
          apiBase={apiBase}
          token={token}
          chatId={chatId}
          compact={compactActions}
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
