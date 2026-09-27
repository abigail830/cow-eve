import { useState } from "react";
import type { ArtifactSpec } from "@fde/artifact-spec";
import {
  ArtifactActionGroup,
  InlineArtifactCardShell,
} from "@fde/artifact-ui";
import { Download, Eye, GitBranch, Loader2, RotateCcw } from "lucide-react";
import type { ChatAttachmentPublic } from "../lib/attachmentUpload";
import {
  effectiveParseStatus,
  parseStatusLabel,
} from "../lib/attachmentParseProgress";
import {
  fetchTranscriptPreview,
  transcriptDownloadUrl,
  type AudioCapturePublic,
} from "../lib/audioCapture";
import { getToken } from "../lib/session";

type Props = {
  capture: AudioCapturePublic;
  chatId: string;
  onOpenPipeline?: (attachment: ChatAttachmentPublic) => void;
  onPreviewArtifact?: (spec: ArtifactSpec) => void;
  onRetry?: () => void | Promise<void>;
};

function asyncSubtitle(
  capture: AudioCapturePublic,
  busy: boolean,
  failed: boolean,
): string {
  if (busy) {
    return "Transcribing in the background — you can keep chatting";
  }
  if (failed) {
    const detail = capture.outputAttachment?.parseErrorMessage?.trim();
    return detail ? `Transcription failed: ${detail}` : "Transcription failed";
  }
  const output = capture.outputAttachment;
  if (output) {
    return parseStatusLabel(output) === "Ready"
      ? "Transcript ready"
      : parseStatusLabel(output);
  }
  return capture.status;
}

export function AudioTranscriptResultCard({
  capture,
  chatId,
  onOpenPipeline,
  onPreviewArtifact,
  onRetry,
}: Props) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const output = capture.outputAttachment;
  const parseStatus = output ? effectiveParseStatus(output) : capture.status;
  const ready = parseStatus === "ready" || capture.status === "ready";
  const failed = parseStatus === "failed" || capture.status === "failed";
  const busy =
    capture.status === "transcribing" ||
    parseStatus === "pending" ||
    parseStatus === "running";

  const spec: ArtifactSpec = {
    kind: "content_document",
    title: capture.title,
    format: "markdown",
    content: "",
    filename: output?.filename ?? `${capture.title}.md`,
    artifact_id: capture.outputAttachmentId ?? capture.id,
    download_url: ready ? transcriptDownloadUrl(chatId, capture.id) : null,
    source: "audio_transcript",
  };

  async function handlePreview() {
    if (!ready || previewLoading) return;
    setPreviewLoading(true);
    try {
      const text = await fetchTranscriptPreview(chatId, capture.id);
      onPreviewArtifact?.({
        ...spec,
        content: text,
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownload() {
    if (!ready) return;
    const url = transcriptDownloadUrl(chatId, capture.id);
    const token = getToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = spec.filename;
    a.click();
    URL.revokeObjectURL(href);
  }

  async function handleRetry() {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <InlineArtifactCardShell
      spec={spec}
      coverKind="audio_transcript"
      cardClassName="audio-transcript-artifact-card"
      actionsAriaLabel="Audio transcript actions"
      subtitle={asyncSubtitle(capture, busy, failed)}
      actions={
        <ArtifactActionGroup>
          {busy ? (
            <span className="audio-transcript-async-badge" role="status">
              <Loader2 size={14} className="artifact-spin" aria-hidden />
              Processing
            </span>
          ) : null}
          {output && onOpenPipeline ? (
            <button
              type="button"
              className="artifact-inline-action-btn"
              onClick={() => onOpenPipeline(output)}
            >
              <GitBranch size={14} />
              <span>Pipeline</span>
            </button>
          ) : null}
          {failed && onRetry ? (
            <button
              type="button"
              className="artifact-inline-action-btn"
              disabled={retrying}
              onClick={() => void handleRetry()}
            >
              <RotateCcw size={14} />
              <span>{retrying ? "Retrying…" : "Retry"}</span>
            </button>
          ) : null}
          {ready ? (
            <>
              <button
                type="button"
                className="artifact-inline-action-btn"
                disabled={previewLoading}
                onClick={() => void handlePreview()}
              >
                {previewLoading ? (
                  <Loader2 size={14} className="artifact-spin" aria-hidden />
                ) : (
                  <Eye size={14} />
                )}
                <span>{previewLoading ? "Loading…" : "Preview"}</span>
              </button>
              <span className="artifact-inline-action-divider" aria-hidden />
              <button
                type="button"
                className="artifact-inline-action-btn"
                onClick={() => void handleDownload()}
              >
                <Download size={14} />
                <span>Download</span>
              </button>
            </>
          ) : null}
        </ArtifactActionGroup>
      }
    />
  );
}
