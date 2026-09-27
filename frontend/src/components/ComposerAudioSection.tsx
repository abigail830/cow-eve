import { useCallback, useEffect, useMemo, useState } from "react";
import { Mic } from "lucide-react";
import type { ChatAttachmentPublic } from "../lib/attachmentUpload";
import { ATTACHMENT_PARSE_POLL_MS } from "../lib/attachmentParseProgress";
import {
  createAudioCaptureDraft,
  fetchAudioCaptures,
  retryAudioCaptureTranscription,
  startAudioCaptureTranscription,
  type AudioCapturePublic,
  type AudioCaptureTarget,
} from "../lib/audioCapture";
import { AudioCaptureInputCard } from "./AudioCaptureInputCard";
import { AudioTranscriptResultCard } from "./AudioTranscriptResultCard";
import "./AudioCapture.css";

type Props = {
  chatId: string | null;
  eveSessionId: string | null;
  agentId: string;
  disabled?: boolean;
  onOpenPipeline: (attachment: ChatAttachmentPublic) => void;
};

export function ComposerAudioSection({
  chatId,
  eveSessionId,
  agentId,
  disabled = false,
  onOpenPipeline,
}: Props) {
  const [resolvedChatId, setResolvedChatId] = useState<string | null>(chatId);
  const [captures, setCaptures] = useState<AudioCapturePublic[]>([]);
  const [draftCapture, setDraftCapture] = useState<AudioCapturePublic | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (chatId) setResolvedChatId(chatId);
  }, [chatId]);

  const target: AudioCaptureTarget = useMemo(
    () => ({
      chatId: resolvedChatId ?? chatId,
      eveSessionId,
      agentId,
    }),
    [agentId, chatId, eveSessionId, resolvedChatId],
  );

  const canUse = Boolean(target.chatId || target.eveSessionId) && !disabled;

  const refresh = useCallback(async () => {
    if (!target.chatId && !target.eveSessionId) {
      setCaptures([]);
      return;
    }
    const rows = await fetchAudioCaptures(target);
    setCaptures(rows);
    if (rows[0]?.chatId) {
      setResolvedChatId(rows[0].chatId);
    }
    if (draftCapture) {
      const updated = rows.find((row) => row.id === draftCapture.id);
      if (updated && updated.status !== "draft") {
        setDraftCapture(null);
      } else if (updated) {
        setDraftCapture(updated);
      }
    }
  }, [draftCapture, target]);

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
    if (!needsPoll) return;
    const id = window.setInterval(() => {
      void refresh();
    }, ATTACHMENT_PARSE_POLL_MS);
    return () => window.clearInterval(id);
  }, [needsPoll, refresh]);

  async function handleNewCapture() {
    if (!canUse || creating) return;
    setError(null);
    setCreating(true);
    try {
      const capture = await createAudioCaptureDraft(target, "Audio transcript");
      setResolvedChatId(capture.chatId);
      setDraftCapture(capture);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start capture.");
    } finally {
      setCreating(false);
    }
  }

  async function handleStart() {
    const cid = draftCapture?.chatId ?? resolvedChatId;
    if (!cid || !draftCapture) return;
    setError(null);
    try {
      await startAudioCaptureTranscription(cid, draftCapture.id);
      setDraftCapture(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed to start.");
    }
  }

  async function handleRetry(captureId: string, cid: string) {
    await retryAudioCaptureTranscription(cid, captureId);
    await refresh();
  }

  const resultCaptures = captures.filter(
    (c) => c.status !== "draft" || (draftCapture && c.id !== draftCapture.id),
  );

  const activeChatId = resolvedChatId ?? draftCapture?.chatId ?? chatId;

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
              : "Connect to the agent before starting a capture"
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
      {draftCapture && activeChatId ? (
        <AudioCaptureInputCard
          capture={draftCapture}
          chatId={activeChatId}
          uploadTarget={target}
          busy={creating}
          onCaptureChange={setDraftCapture}
          onStart={handleStart}
          onClose={() => setDraftCapture(null)}
        />
      ) : null}
      {activeChatId
        ? resultCaptures.map((capture) => (
            <AudioTranscriptResultCard
              key={capture.id}
              capture={capture}
              chatId={activeChatId}
              onOpenPipeline={onOpenPipeline}
              onRetry={
                capture.status === "failed" ||
                capture.outputAttachment?.parseStatus === "failed"
                  ? () => handleRetry(capture.id, capture.chatId)
                  : undefined
              }
            />
          ))
        : null}
    </>
  );
}
