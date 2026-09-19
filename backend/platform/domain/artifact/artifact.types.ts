export type {
  ArtifactFormat,
  ArtifactKind,
  ArtifactSpec,
  PublishArtifactOutput,
} from "../../../../packages/artifact-spec/src/index.js";

export type ChatArtifactFormat =
  | "slidev"
  | "html"
  | "pdf"
  | "markdown"
  | "docx"
  | "pptx"
  | "svg";

export type ChatArtifactMeta = {
  kind: string;
  filename: string;
  format: ChatArtifactFormat;
  media_type: string;
  source_object: string;
  preview_index: string | null;
  preview_files: Record<string, string>;
  variants: Record<
    string,
    {
      filename: string;
      format: string;
      media_type: string;
      object_name: string;
    }
  >;
};

export type ArtifactPayload = {
  data: Uint8Array;
  mediaType: string;
  filename: string;
};
