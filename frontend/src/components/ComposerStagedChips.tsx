import { FileText, ImageIcon, X } from "lucide-react";
import { formatBytes, isImageMime, type PreparedAttachment } from "../lib/attachments";
import "./ComposerStagedChips.css";

type Props = {
  attachments: readonly PreparedAttachment[];
  onRemove: (id: string) => void;
};

function AttachmentIcon({ mediaType }: { mediaType: string }) {
  if (isImageMime(mediaType)) {
    return <ImageIcon size={14} strokeWidth={2} aria-hidden />;
  }
  return <FileText size={14} strokeWidth={2} aria-hidden />;
}

export function ComposerStagedChips({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null;

  return (
    <div className="composer-staged" aria-label="Staged attachments">
      {attachments.map((attachment) => (
        <span key={attachment.id} className="composer-staged-chip">
          <AttachmentIcon mediaType={attachment.mediaType} />
          <span className="composer-staged-name" title={attachment.filename}>
            {attachment.filename}
          </span>
          <span className="composer-staged-size">{formatBytes(attachment.sizeBytes)}</span>
          {attachment.compressed ? (
            <span
              className="composer-staged-badge"
              title="Re-encoded as JPEG for multimodal model compatibility"
            >
              Optimized
            </span>
          ) : null}
          {attachment.uploadState === "uploading" ? (
            <span className="composer-staged-badge">Uploading</span>
          ) : null}
          {attachment.uploadState === "uploaded" ? (
            <span className="composer-staged-badge" title="Saved to attachment library">
              Saved
            </span>
          ) : null}
          {attachment.uploadState === "error" ? (
            <span
              className="composer-staged-badge composer-staged-badge-error"
              title={attachment.uploadError ?? "Upload failed"}
            >
              Upload failed
            </span>
          ) : null}
          <button
            type="button"
            className="composer-staged-remove"
            aria-label={`Remove ${attachment.filename}`}
            onClick={() => onRemove(attachment.id)}
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </span>
      ))}
    </div>
  );
}
