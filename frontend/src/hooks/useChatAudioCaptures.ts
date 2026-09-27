import { useCallback, useEffect, useMemo, useState } from "react";
import { ATTACHMENT_PARSE_POLL_MS } from "../lib/attachmentParseProgress";
import {
  fetchAudioCaptures,
  retryAudioCaptureTranscription,
  type AudioCapturePublic,
  type AudioCaptureTarget,
} from "../lib/audioCapture";

export function useChatAudioCaptures(input: {
  target: AudioCaptureTarget;
  enabled?: boolean;
  refreshKey?: number;
}) {
  const { target, enabled = true, refreshKey = 0 } = input;
  const [captures, setCaptures] = useState<AudioCapturePublic[]>([]);
  const [loading, setLoading] = useState(false);

  const canFetch = Boolean(
    enabled && (target.chatId || target.eveSessionId),
  );

  const refresh = useCallback(async () => {
    if (!canFetch) {
      setCaptures([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchAudioCaptures(target);
      setCaptures(rows);
    } catch {
      /* keep prior rows */
    } finally {
      setLoading(false);
    }
  }, [canFetch, target]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const submittedCaptures = useMemo(
    () =>
      captures
        .filter((c) => c.status !== "draft")
        .sort(
          (a, b) =>
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
        ),
    [captures],
  );

  const needsPoll = captures.some(
    (c) =>
      c.status === "transcribing" ||
      c.outputAttachment?.parseStatus === "pending" ||
      c.outputAttachment?.parseStatus === "running",
  );

  useEffect(() => {
    if (!canFetch || !needsPoll) return;
    const id = window.setInterval(() => {
      void refresh();
    }, ATTACHMENT_PARSE_POLL_MS);
    return () => window.clearInterval(id);
  }, [canFetch, needsPoll, refresh]);

  const retryCapture = useCallback(
    async (chatId: string, captureId: string) => {
      await retryAudioCaptureTranscription(chatId, captureId);
      await refresh();
    },
    [refresh],
  );

  return {
    captures,
    submittedCaptures,
    loading,
    refresh,
    retryCapture,
  };
}
