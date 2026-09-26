import type { AttachmentKind } from "../../domain/attachment/attachment-kinds.js";

export type PipelineResolution =
  | { action: "skip" }
  | { action: "reject" }
  | { action: "parse"; pipelineId: string };

/** Port of agent-platform parse_pipeline/router.py */
export function resolvePipeline(kind: AttachmentKind): PipelineResolution {
  if (kind === "image") return { action: "skip" };
  if (kind === "office") {
    return { action: "parse", pipelineId: "office_standard" };
  }
  if (kind === "text") {
    return { action: "parse", pipelineId: "text_standard" };
  }
  if (kind === "sheet") {
    return { action: "parse", pipelineId: "sheet_standard" };
  }
  if (kind === "pdf") {
    return { action: "parse", pipelineId: "pdf_standard" };
  }
  if (kind === "audio") {
    return {
      action: "parse",
      pipelineId: "audio_transcription_standard",
    };
  }
  return { action: "reject" };
}
