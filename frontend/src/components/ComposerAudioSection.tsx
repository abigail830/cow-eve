import { useCallback, useEffect, useState } from "react";
import { Mic } from "lucide-react";
import type { ChatAttachmentPublic } from "../lib/attachmentUpload";
import { ATTACHMENT_PARSE_POLL_MS } from "../lib/attachmentParseProgress";
import {
  createAudioCaptureDraft,
  fetchAudioCaptures,
  retryAudioCaptureTranscription,
  startAudioCaptureTranscription,
  type AudioCapturePublic,
} from "../lib/audioCapture";
import { AudioCaptureInputCard } from "./AudioCaptureInputCard";
import { AudioTranscriptResultCard } from "./AudioTranscriptResultCard";
import "./AudioCapture.css";

type Props = {
  chatId: string | null;
  sessionReady: boolean;
  disabled?: boolean;
  onOpenPipeline: (attachment: ChatAttachmentPublic) => void;
};

export function ComposerAudioSection({
  chatId,
  sessionReady,
  disabled = false,
  onOpenPipeline,
}: Props) {
  const [captures, setCaptures] = useState<AudioCapturePublic[]>([]);
  const [draftCapture, setDraftCapture] = useState<AudioCapturePublic | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUse = Boolean(chatId) && sessionReady && !disabled;

  const refresh = useCallback(async () => {
    if (!chatId) {
      setCaptures([]);
      return;
    }
    const rows = await fetchAudioCaptures(chatId);
    setCaptures(rows);
    if (draftCapture) {
      const updated = rows.find((row) => row.id === draftCapture.id);
      if (updated && updated.status !== "draft") {
        setDraftCapture(null);
      } else if (updated) {
        setDraftCapture(updated);
      }
    }
  }, [chatId, draftCapture]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const needsPoll = captures.some(
    (c) =>
      c.status === "transcribing" ||
      c.outputAttachment?.parseStatus === "pending" ||
      c.outputAttachment?.parseStatus === "running",
  );

  useEffect(() => {
    if (!needsPoll || !chatId) return;
    const id = window.setInterval(() => {
      void refresh();
    }, ATTACHMENT_PARSE_POLL_MS);
    return () => window.clearInterval(id);
  }, [chatId, needsPoll, refresh]);

  async function handleNewCapture() {
    if (!chatId || !canUse || creating) return;
    setError(null);
    setCreating(true);
    try {
      const capture = await createAudioCaptureDraft(chatId, "Audio transcript");
      setDraftCapture(capture);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start capture.");
    } finally {
      setCreating(false);
    }
  }

  async function handleStart() {
    if (!chatId || !draftCapture) return;
    setError(null);
    try {
      await startAudioCaptureTranscription(chatId, draftCapture.id);
      setDraftCapture(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed to start.");
    }
  }

  async function handleRetry(captureId: string) {
    if (!chatId) return;
    await retryAudioCaptureTranscription(chatId, captureId);
    await refresh();
  }

  const resultCaptures = captures.filter(
    (c) => c.status !== "draft" || (draftCapture && c.id !== draftCapture.id),
  );

  return (
    <>
      <div className="composer-audio-toolbar">
        <button
          type="button"
          className="composer-audio-toolbar-btn"
          disabled={!canUse || creating}
          title={
            canUse
              ? "Create an audio transcript capture"
              : "Send a message first to start a capture"
          }
          onClick={() => void handleNewCapture()}
        >
          <Mic size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Audio transcript
        </button>
      </div>
      {error ? (
        <p className="audio-capture-error" role="alert">
          {error}
        </p>
      ) : null}
      {draftCapture && chatId ? (
        <AudioCaptureInputCard
          capture={draftCapture}
          chatId={chatId}
          busy={creating}
          onCaptureChange={setDraftCapture}
          onStart={handleStart}
          onClose={() => setDraftCapture(null)}
        />
      ) : null}
      {resultCaptures.map((capture) => (
        <AudioTranscriptResultCard
          key={capture.id}
          capture={capture}
          chatId={chatId!}
          onOpenPipeline={onOpenPipeline}
          onRetry={
            capture.status === "failed" ||
            capture.outputAttachment?.parseStatus === "failed"
              ? () => handleRetry(capture.id)
              : undefined
          }
        />
      ))}
    </>
  );
}
