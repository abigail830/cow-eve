import type { ArtifactSpec } from "@fde/artifact-spec";
import { PreviewDownloadActions } from "./ArtifactCardActions";
import { resolveArtifactCoverKind } from "./ArtifactCoverIllustration";
import { InlineArtifactCardShell } from "./InlineArtifactCardShell";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  chatId?: string | null;
  compactActions?: boolean;
  onPreview?: (spec: ArtifactSpec) => void;
};

/**
 * Slide deck deliverable (HTML slides today; slidev would use the same card + slides cover).
 * Cover resolves to `web` for .html decks, `slides` for slidev if ever published.
 */
export function HtmlArtifactCard({
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
      coverKind={resolveArtifactCoverKind(spec)}
      cardClassName="html-artifact-card slide-deck-artifact-card"
      actionsAriaLabel="Slide deck actions"
      actions={
        <PreviewDownloadActions
          spec={spec}
          apiBase={apiBase}
          token={token}
          chatId={chatId}
          compact={compactActions}
          onPreview={onPreview}
          canPreview={Boolean(spec.preview_url?.trim())}
          canDownload={Boolean(spec.download_url?.trim())}
          previewLabel="Preview"
          downloadLabel="Download"
        />
      }
    />
  );
}

/** Alias — same component, explicit export name. */
export const DeckArtifactCard = HtmlArtifactCard;
