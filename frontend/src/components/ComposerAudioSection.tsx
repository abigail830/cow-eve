import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Mic } from "lucide-react";
import {
  createLocalAudioCaptureDraft,
  fetchAudioCaptures,
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
  /** Refresh capture list only — do not reload the whole chat session. */
  onCaptureActivity?: () => void;
  /** Platform chat row appeared (first upload); keep composer draft mounted. */
  onCaptureChatLinked?: (chatId: string) => void;
  /** Fired as soon as Start succeeds (before stream reload). */
  onCaptureStarted?: (capture: AudioCapturePublic) => void;
};

export function useComposerAudioDraft({
  chatId,
  eveSessionId,
  agentId,
  disabled = false,
  onCaptureActivity,
  onCaptureChatLinked,
  onCaptureStarted,
}: DraftHookInput) {
  const [resolvedChatId, setResolvedChatId] = useState<string | null>(chatId);
  const [draftCapture, setDraftCapture] = useState<AudioCapturePublic | null>(null);
  const [starting, setStarting] = useState(false);
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

  async function handleNewCapture() {
    if (!canUse || draftCapture) return;
    setError(null);
    try {
      const existing = await fetchAudioCaptures(target);
      const openDraft = existing
        .filter((c) => c.status === "draft")
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0];
      if (openDraft) {
        setDraftCapture(openDraft);
        if (openDraft.chatId) setResolvedChatId(openDraft.chatId);
        return;
      }
    } catch {
      /* fall through to local draft */
    }
    setDraftCapture(createLocalAudioCaptureDraft("Audio transcript"));
  }

  const handleStart = useCallback(async () => {
    const cid = draftCapture?.chatId ?? resolvedChatId;
    if (!cid || !draftCapture || isClientOnlyAudioCapture(draftCapture) || starting) {
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const capture = await startAudioCaptureTranscription(cid, draftCapture.id);
      setDraftCapture(null);
      onCaptureStarted?.(capture);
      onCaptureActivity?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Transcription failed to start.",
      );
    } finally {
      setStarting(false);
    }
  }, [draftCapture, onCaptureActivity, onCaptureStarted, resolvedChatId, starting]);

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
        onClick={() => void handleNewCapture()}
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
          if (next.chatId) {
            setResolvedChatId(next.chatId);
            onCaptureChatLinked?.(next.chatId);
          }
          onCaptureActivity?.();
        }}
        onStart={handleStart}
        starting={starting}
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
