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
    <div className="composer-staged" aria-label="待发送附件">
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
              title="已转为 JPEG 并优化，确保多模态模型能正确识别"
            >
              已优化
            </span>
          ) : null}
          <button
            type="button"
            className="composer-staged-remove"
            aria-label={`移除 ${attachment.filename}`}
            onClick={() => onRemove(attachment.id)}
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </span>
      ))}
    </div>
  );
}
