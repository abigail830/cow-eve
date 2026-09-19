import type { ArtifactSpec } from "@fde/artifact-spec";
import {
  isMarkdownPreviewable,
  isPptArtifact,
  isWordArtifact,
} from "./artifactKinds";
import { resolveArtifactUrls } from "./api";
import { HtmlPreviewFrame } from "./HtmlPreviewFrame";
import { OoxmlPreview } from "./OoxmlPreview";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  chatId?: string | null;
};

export function ArtifactPreviewContent({ spec, apiBase, token, chatId }: Props) {
  const { previewUrl, downloadUrl } = resolveArtifactUrls(spec, apiBase, chatId);

  if (isWordArtifact(spec) && downloadUrl) {
    return (
      <OoxmlPreview kind="docx" url={downloadUrl} token={token} title={spec.title} />
    );
  }

  if (isPptArtifact(spec) && downloadUrl) {
    return (
      <OoxmlPreview kind="pptx" url={downloadUrl} token={token} title={spec.title} />
    );
  }

  if (isMarkdownPreviewable(spec) && spec.content) {
    return <pre className="artifact-preview-markdown">{spec.content}</pre>;
  }

  if (spec.kind === "diagram_svg" && spec.content) {
    return (
      <div
        className="artifact-preview-markdown artifact-preview-diagram"
        dangerouslySetInnerHTML={{ __html: spec.content }}
      />
    );
  }

  if (previewUrl) {
    return <HtmlPreviewFrame url={previewUrl} token={token} title={spec.title} />;
  }

  return <p className="artifact-preview-status">Nothing to preview.</p>;
}
