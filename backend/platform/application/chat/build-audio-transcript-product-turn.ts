import type { AudioCapturePublic } from "../attachment/audio-capture.use-case.js";
import type {
  PlatformProductTurnBundle,
} from "../../domain/chat/platform-product-turn.types.js";
import {
  formatPlatformAttachmentRefs,
  PLATFORM_PRODUCT_STARTED_EVENT,
  platformAudioTurnId,
} from "../../domain/chat/platform-product-turn.types.js";
import type { PersistableEvent } from "../../domain/chat/stream-event.types.js";

const PUBLISH_TOOL = "publish";

function newEventId(): string {
  return `evt_${crypto.randomUUID().replace(/-/g, "")}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

/** Matches @fde/artifact-spec ArtifactSpec fields used by publish + UI. */
export type ProductTurnArtifactSpec = {
  kind: "content_document";
  title: string;
  format: "markdown";
  content: string;
  filename: string;
  artifact_id: string;
  download_url: string | null;
  source: "audio_transcript";
};

export function buildArtifactSpecForAudioCapture(
  capture: AudioCapturePublic,
): ProductTurnArtifactSpec {
  const output = capture.outputAttachment;
  return {
    kind: "content_document",
    title: capture.title,
    format: "markdown",
    content: "",
    filename: output?.filename ?? `${capture.title}.md`,
    artifact_id: capture.outputAttachmentId ?? "",
    download_url: null,
    source: "audio_transcript",
  };
}

export function buildAudioTranscriptProductTurn(input: {
  capture: AudioCapturePublic;
  artifactSpec: ProductTurnArtifactSpec;
}): PlatformProductTurnBundle {
  const { capture, artifactSpec } = input;
  const turnId = platformAudioTurnId(capture.id);
  const callId = `call_pt_${capture.id.replace(/-/g, "").slice(0, 24)}`;
  const at = isoNow();

  if (!capture.outputAttachmentId) {
    throw new Error("Platform product turn requires transcript output attachment id.");
  }
  const outputAttachmentId: string = capture.outputAttachmentId;
  const attachmentIds: string[] = [
    outputAttachmentId,
    ...capture.parts.map((part) => part.attachmentId),
  ];
  const refsLine = formatPlatformAttachmentRefs({
    product: "audio_transcript",
    instanceId: capture.id,
    outputAttachmentId,
    attachmentIds,
  });

  const fileParts = capture.parts.map((part) => ({
    type: "file" as const,
    filename: part.filename,
    mediaType: part.mediaType,
    size: part.sizeBytes,
  }));

  const mk = (type: string, data: Record<string, unknown>): PersistableEvent => ({
    type,
    meta: { id: newEventId(), at },
    data,
  });

  const events: PersistableEvent[] = [
    mk("turn.started", { turnId, sequence: 0 }),
    mk(PLATFORM_PRODUCT_STARTED_EVENT, {
      turnId,
      sequence: 0,
      title: capture.title,
      platform: {
        product: "audio_transcript",
        version: 1,
        instanceId: capture.id,
        title: capture.title,
      },
      parts: fileParts,
      attachmentRefs: {
        product: "audio_transcript",
        instanceId: capture.id,
        outputAttachmentId,
        attachmentIds,
      },
    }),
    mk("actions.requested", {
      turnId,
      sequence: 0,
      stepIndex: 0,
      actions: [
        {
          kind: "tool-call",
          callId,
          toolName: PUBLISH_TOOL,
          input: { path: "", title: capture.title },
        },
      ],
    }),
    mk("action.result", {
      turnId,
      sequence: 0,
      stepIndex: 0,
      status: "completed",
      result: {
        kind: "tool-result",
        callId,
        toolName: PUBLISH_TOOL,
        output: {
          status: "queued",
          queued: true,
          ...artifactSpec,
          platform_attachment_refs: refsLine,
        },
      },
    }),
    mk("turn.completed", { turnId, sequence: 0 }),
  ];

  return { turnId, events };
}
