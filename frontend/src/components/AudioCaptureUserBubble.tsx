import { formatBytes } from "../lib/attachments";
import type { AudioCapturePublic } from "../lib/audioCapture";
import { AudioTranscriptIcon } from "./AudioTranscriptIcon";
import "./AudioCapture.css";

type Props = {
  capture: AudioCapturePublic;
};

/** User-side message bubble for a submitted audio transcript request. */
export function AudioCaptureUserBubble({ capture }: Props) {
  return (
    <div className="audio-capture-user-bubble" role="article" aria-label="Audio transcript request">
      <div className="audio-capture-user-bubble-head">
        <AudioTranscriptIcon size={20} className="audio-capture-user-bubble-icon" />
        <span className="audio-capture-user-bubble-label">Audio transcript</span>
      </div>
      <p className="audio-capture-user-bubble-title">{capture.title}</p>
      <ul className="audio-capture-user-bubble-parts">
        {capture.parts.map((part) => (
          <li key={part.attachmentId}>
            <span>{part.filename}</span>
            <span className="audio-capture-user-bubble-size">
              {formatBytes(part.sizeBytes)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
