import type { ArtifactSpec } from "@fde/artifact-spec";
import { DownloadOnlyAction } from "./ArtifactCardActions";
import { InlineArtifactCardShell } from "./InlineArtifactCardShell";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
};

/** PowerPoint (.pptx) deliverable — slides cover, download only. */
export function PptArtifactCard({ spec, apiBase, token }: Props) {
  return (
    <InlineArtifactCardShell
      spec={spec}
      coverKind="slides"
      cardClassName="ppt-artifact-card"
      actionsAriaLabel="PowerPoint actions"
      actions={
        <DownloadOnlyAction spec={spec} apiBase={apiBase} token={token} downloadLabel="Download" />
      }
    />
  );
}
