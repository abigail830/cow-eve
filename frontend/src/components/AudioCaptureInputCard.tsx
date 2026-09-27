import { useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { ATTACHMENT_LIMITS, formatBytes } from "../lib/attachments";
import {
  AUDIO_ACCEPT,
  type AudioCapturePublic,
  type AudioCaptureTarget,
  uploadAudioCapturePart,
  validateAudioCaptureFile,
} from "../lib/audioCapture";
import "./AudioCapture.css";

type Props = {
  capture: AudioCapturePublic;
  uploadTarget: AudioCaptureTarget;
  onCaptureChange: (capture: AudioCapturePublic) => void;
  onStart: () => void | Promise<void>;
  starting?: boolean;
  onClose: () => void;
};

export function AudioCaptureInputCard({
  capture,
  uploadTarget,
  onCaptureChange,
  onStart,
  starting = false,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpload =
    Boolean(uploadTarget.chatId || uploadTarget.eveSessionId);

  async function handleFiles(list: FileList | null) {
    if (!list?.length || !canUpload) return;
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
        current = await uploadAudioCapturePart(current, file, uploadTarget);
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
    !uploading &&
    !starting &&
    Boolean(capture.chatId) &&
    capture.parts.length > 0 &&
    capture.status === "draft";

  return (
    <div className="audio-capture-card" role="region" aria-label="Audio transcript capture">
      <div className="audio-capture-card-header">
        <div>
          <h4 className="audio-capture-card-title">Audio transcript</h4>
          <p className="audio-capture-card-sub">
            Add recordings, then start transcription. Results appear above as a transcript card.
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
          disabled={!canUpload || uploading}
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
          {starting ? (
            <>
              <Loader2 size={14} className="parse-pipeline-node-spinner" /> Starting…
            </>
          ) : (
            "Start transcript"
          )}
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
