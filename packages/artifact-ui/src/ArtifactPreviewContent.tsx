import type { ArtifactSpec } from "@fde/artifact-spec";
import {
  isMarkdownPreviewable,
  isPptArtifact,
  isWordArtifact,
} from "./artifactKinds";
import { resolveArtifactUrl } from "./api";
import { HtmlPreviewFrame } from "./HtmlPreviewFrame";
import { OoxmlPreview } from "./OoxmlPreview";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
};

export function ArtifactPreviewContent({ spec, apiBase, token }: Props) {
  const previewUrl = resolveArtifactUrl(spec.preview_url, apiBase);
  const downloadUrl = resolveArtifactUrl(spec.download_url, apiBase);

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
