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

/** Markdown deliverable — markdown cover, preview + download. */
export function MarkdownArtifactCard({
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
      coverKind="markdown"
      cardClassName="markdown-artifact-card"
      actionsAriaLabel="Markdown actions"
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
