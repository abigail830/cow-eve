import type { ArtifactSpec } from "@fde/artifact-spec";
import { resolveArtifactCardType } from "./artifactKinds";
import { ContentDocumentArtifactCard } from "./ContentDocumentArtifactCard";
import { DiagramArtifactCard } from "./DiagramArtifactCard";
import { HtmlArtifactCard } from "./HtmlArtifactCard";
import { MarkdownArtifactCard } from "./MarkdownArtifactCard";
import { PptArtifactCard } from "./PptArtifactCard";
import { WordArtifactCard } from "./WordArtifactCard";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  chatId?: string | null;
  compactActions?: boolean;
  onPreview?: (spec: ArtifactSpec) => void;
};

export function ArtifactCard(props: Props) {
  switch (resolveArtifactCardType(props.spec)) {
    case "diagram":
      return <DiagramArtifactCard {...props} />;
    case "html":
      return <HtmlArtifactCard {...props} />;
    case "word":
      return <WordArtifactCard {...props} />;
    case "ppt":
      return <PptArtifactCard {...props} />;
    case "markdown":
      return <MarkdownArtifactCard {...props} />;
    default:
      return <ContentDocumentArtifactCard {...props} />;
  }
}

/** @deprecated Use ArtifactCard */
export const ArtifactBubble = ArtifactCard;
