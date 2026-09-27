import { useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { ATTACHMENT_LIMITS, formatBytes } from "../lib/attachments";
import {
  AUDIO_ACCEPT,
  type AudioCapturePublic,
  uploadAudioCapturePart,
  validateAudioCaptureFile,
} from "../lib/audioCapture";
import "./AudioCapture.css";

type Props = {
  capture: AudioCapturePublic;
  chatId: string;
  busy?: boolean;
  onCaptureChange: (capture: AudioCapturePublic) => void;
  onStart: () => void | Promise<void>;
  onClose: () => void;
};

export function AudioCaptureInputCard({
  capture,
  chatId,
  busy = false,
  onCaptureChange,
  onStart,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(list: FileList | null) {
    if (!list?.length || busy) return;
    setError(null);
    setUploading(true);
    try {
      let current = capture;
      for (const file of Array.from(list)) {
        const validation = validateAudioCaptureFile(
          file,
          ATTACHMENT_LIMITS.maxBytesPerFile,
        );
        if (validation) {
          setError(validation);
          continue;
        }
        if (current.parts.length >= ATTACHMENT_LIMITS.maxAudioFilesPerCapture) {
          setError(
            `At most ${ATTACHMENT_LIMITS.maxAudioFilesPerCapture} audio files per capture.`,
          );
          break;
        }
        current = await uploadAudioCapturePart(chatId, current.id, file);
        onCaptureChange(current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const canStart =
    !busy && !uploading && capture.parts.length > 0 && capture.status === "draft";

  return (
    <div className="audio-capture-card" role="region" aria-label="Audio transcript capture">
      <div className="audio-capture-card-header">
        <div>
          <h4 className="audio-capture-card-title">Audio transcript capture</h4>
          <p className="audio-capture-card-sub">
            Add one or more recordings. They will be merged into a single transcript.
          </p>
        </div>
        <button
          type="button"
          className="audio-capture-close"
          onClick={onClose}
          aria-label="Close capture"
        >
          <X size={16} />
        </button>
      </div>
      <p className="audio-capture-card-sub" style={{ marginTop: 8 }}>
        <strong>{capture.title}</strong>
      </p>
      <ul className="audio-capture-parts">
        {capture.parts.length === 0 ? (
          <li className="audio-capture-part">No audio files yet.</li>
        ) : (
          capture.parts.map((part) => (
            <li key={part.attachmentId} className="audio-capture-part">
              <span>{part.filename}</span>
              <span>{formatBytes(part.sizeBytes)}</span>
            </li>
          ))
        )}
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <div className="audio-capture-actions">
        <button
          type="button"
          disabled={busy || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="parse-pipeline-node-spinner" /> Uploading…
            </>
          ) : (
            <>
              <Plus size={14} style={{ verticalAlign: "middle" }} /> Add audio
            </>
          )}
        </button>
        <button
          type="button"
          className="primary"
          disabled={!canStart}
          onClick={() => void onStart()}
        >
          Start transcription
        </button>
      </div>
      {error ? (
        <p className="audio-capture-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
