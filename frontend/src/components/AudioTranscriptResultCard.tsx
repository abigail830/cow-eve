import { useState } from "react";
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
import { AudioTranscriptIcon } from "./AudioTranscriptIcon";
import "./AudioCapture.css";

type Props = {
  capture: AudioCapturePublic;
  chatId: string;
  onOpenPipeline?: (attachment: ChatAttachmentPublic) => void;
  onRetry?: () => void | Promise<void>;
};

export function AudioTranscriptResultCard({
  capture,
  chatId,
  onOpenPipeline,
  onRetry,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const output = capture.outputAttachment;
  const parseStatus = output ? effectiveParseStatus(output) : capture.status;
  const ready = parseStatus === "ready" || capture.status === "ready";
  const failed = parseStatus === "failed" || capture.status === "failed";
  const busy =
    capture.status === "transcribing" ||
    parseStatus === "pending" ||
    parseStatus === "running";

  async function handlePreview() {
    if (preview) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const text = await fetchTranscriptPreview(chatId, capture.id);
      setPreview(text);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownload() {
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
    a.download = output?.filename ?? `${capture.title}.md`;
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

  const statusText = output
    ? parseStatusLabel(output)
    : busy
      ? "Transcribing"
      : capture.status;

  return (
    <div className="audio-transcript-result-card" role="article">
      <div className="audio-transcript-result-header">
        <div className="audio-transcript-result-body" style={{ marginTop: 0 }}>
          <AudioTranscriptIcon size={44} />
          <div>
            <h4 className="audio-transcript-result-title">{capture.title}</h4>
            <p className="audio-transcript-result-sub">
              {capture.parts.length} audio file{capture.parts.length === 1 ? "" : "s"} ·{" "}
              {statusText}
              {busy ? (
                <>
                  {" "}
                  <Loader2
                    size={12}
                    className="parse-pipeline-node-spinner"
                    aria-hidden
                  />
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="audio-transcript-result-actions">
          {output && onOpenPipeline ? (
            <button type="button" onClick={() => onOpenPipeline(output)}>
              <GitBranch size={14} /> Pipeline
            </button>
          ) : null}
          {failed && onRetry ? (
            <button type="button" disabled={retrying} onClick={() => void handleRetry()}>
              <RotateCcw size={14} /> {retrying ? "Retrying…" : "Retry"}
            </button>
          ) : null}
          {ready ? (
            <>
              <button type="button" disabled={previewLoading} onClick={() => void handlePreview()}>
                <Eye size={14} /> {preview ? "Hide" : previewLoading ? "Loading…" : "Preview"}
              </button>
              <button type="button" onClick={() => void handleDownload()}>
                <Download size={14} /> Download
              </button>
            </>
          ) : null}
        </div>
      </div>
      {previewError ? (
        <p className="audio-capture-error" role="alert">
          {previewError}
        </p>
      ) : null}
      {preview ? <pre className="audio-transcript-preview">{preview}</pre> : null}
    </div>
  );
}
