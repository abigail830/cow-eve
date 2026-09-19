import type { ArtifactSpec } from "@fde/artifact-spec";
import { HtmlArtifactCard } from "./HtmlArtifactCard";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  onPreview?: (spec: ArtifactSpec) => void;
};

/** @deprecated Use HtmlArtifactCard / DeckArtifactCard */
export function SlideDeckArtifactCard(props: Props) {
  return <HtmlArtifactCard {...props} />;
}
