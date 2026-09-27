import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Mic } from "lucide-react";
import {
  createLocalAudioCaptureDraft,
  isClientOnlyAudioCapture,
  startAudioCaptureTranscription,
  type AudioCapturePublic,
  type AudioCaptureTarget,
} from "../lib/audioCapture";
import { AudioCaptureInputCard } from "./AudioCaptureInputCard";
import "./AudioCapture.css";

type DraftHookInput = {
  chatId: string | null;
  eveSessionId: string | null;
  agentId: string;
  disabled?: boolean;
  onCaptureActivity?: () => void;
};

export function useComposerAudioDraft({
  chatId,
  eveSessionId,
  agentId,
  disabled = false,
  onCaptureActivity,
}: DraftHookInput) {
  const [resolvedChatId, setResolvedChatId] = useState<string | null>(chatId);
  const [draftCapture, setDraftCapture] = useState<AudioCapturePublic | null>(null);
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

  function handleNewCapture() {
    if (!canUse || draftCapture) return;
    setError(null);
    setDraftCapture(createLocalAudioCaptureDraft("Audio transcript"));
  }

  const handleStart = useCallback(async () => {
    const cid = draftCapture?.chatId ?? resolvedChatId;
    if (!cid || !draftCapture || isClientOnlyAudioCapture(draftCapture)) return;
    setError(null);
    try {
      await startAudioCaptureTranscription(cid, draftCapture.id);
      setDraftCapture(null);
      onCaptureActivity?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Transcription failed to start.",
      );
    }
  }, [draftCapture, onCaptureActivity, resolvedChatId]);

  const transcriptToolbar = (
    <div className="composer-audio-toolbar">
      <button
        type="button"
        className="composer-audio-toolbar-btn"
        disabled={!canUse || Boolean(draftCapture)}
        title={
          draftCapture
            ? "Finish or close the current capture first"
            : canUse
              ? "Transcribe one or more audio files"
              : "Connect to the agent before starting a capture"
        }
        onClick={handleNewCapture}
      >
        <Mic size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
        Audio transcript
      </button>
    </div>
  );

  let draftCard: ReactNode = null;
  if (draftCapture) {
    draftCard = (
      <AudioCaptureInputCard
        capture={draftCapture}
        uploadTarget={target}
        onCaptureChange={(next) => {
          setDraftCapture(next);
          if (next.chatId) setResolvedChatId(next.chatId);
          onCaptureActivity?.();
        }}
        onStart={handleStart}
        onClose={() => setDraftCapture(null)}
      />
    );
  }

  return {
    error,
    draftCard,
    transcriptToolbar,
    hasDraft: Boolean(draftCapture),
  };
}
