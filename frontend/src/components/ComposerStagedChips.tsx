import { FileText, ImageIcon, X } from "lucide-react";
import { formatBytes, isImageMime, type PreparedAttachment } from "../lib/attachments";
import type { ChatAttachmentPublic } from "../lib/attachmentUpload";
import {
  parseNotRequired,
  parseStageMessage,
  parseStatusLabel,
} from "../lib/attachmentParseProgress";
import "./ComposerStagedChips.css";

type Props = {
  attachments: readonly PreparedAttachment[];
  libraryById?: ReadonlyMap<string, ChatAttachmentPublic>;
  onRemove: (id: string) => void;
};

function AttachmentIcon({ mediaType }: { mediaType: string }) {
  if (isImageMime(mediaType)) {
    return <ImageIcon size={14} strokeWidth={2} aria-hidden />;
  }
  return <FileText size={14} strokeWidth={2} aria-hidden />;
}

export function ComposerStagedChips({
  attachments,
  libraryById,
  onRemove,
}: Props) {
  if (attachments.length === 0) return null;

  return (
    <div className="composer-staged" aria-label="Staged attachments">
      {attachments.map((attachment) => {
        const libraryRow = attachment.platformId
          ? libraryById?.get(attachment.platformId)
          : undefined;
        const parseLabel =
          libraryRow && !parseNotRequired(libraryRow)
            ? parseStatusLabel(libraryRow)
            : null;
        const parseDetail = libraryRow ? parseStageMessage(libraryRow) : null;

        return (
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
          {attachment.uploadState === "uploaded" && !parseLabel ? (
            <span className="composer-staged-badge" title="Saved to attachment library">
              Saved
            </span>
          ) : null}
          {parseLabel ? (
            <span
              className="composer-staged-badge"
              title={parseDetail ?? parseLabel}
            >
              {parseLabel}
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
        );
      })}
    </div>
  );
}
