import type { ArtifactSpec } from "@fde/artifact-spec";
import { DownloadOnlyAction } from "./ArtifactCardActions";
import { InlineArtifactCardShell } from "./InlineArtifactCardShell";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
};

/** Word (.docx) deliverable — document cover, download only. */
export function WordArtifactCard({ spec, apiBase, token }: Props) {
  return (
    <InlineArtifactCardShell
      spec={spec}
      coverKind="word"
      cardClassName="word-artifact-card"
      actionsAriaLabel="Word document actions"
      actions={
        <DownloadOnlyAction spec={spec} apiBase={apiBase} token={token} downloadLabel="Download" />
      }
    />
  );
}
