import type { ReactNode } from "react";
import { publishArtifactOutputSchema, type ArtifactSpec } from "@fde/artifact-spec";
import { ArtifactCard } from "./ArtifactCard";

const PUBLISH_TOOL_NAMES = new Set([
  "publish_artifact",
  "artifacts__publish",
  "artifacts__publish_artifact",
]);

export function resolveArtifactToolPart(input: {
  toolName: string;
  output: unknown;
  apiBase: string;
  token?: string | null;
  onPreview?: (spec: ArtifactSpec) => void;
}): ReactNode | null {
  if (!PUBLISH_TOOL_NAMES.has(input.toolName)) return null;
  if (!input.output || typeof input.output !== "object") return null;

  const parsed = publishArtifactOutputSchema.safeParse(input.output);
  if (!parsed.success || parsed.data.status === "error") return null;

  return (
    <ArtifactCard
      spec={parsed.data}
      apiBase={input.apiBase}
      token={input.token}
      onPreview={input.onPreview}
    />
  );
}
