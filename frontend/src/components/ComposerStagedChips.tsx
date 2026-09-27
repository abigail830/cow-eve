import { FileText, ImageIcon, Loader2, X } from "lucide-react";
import { formatBytes, isImageMime, type PreparedAttachment } from "../lib/attachments";
import type { ChatAttachmentPublic } from "../lib/attachmentUpload";
import {
  attachmentParseInProgress,
  effectiveParseStatus,
  likelyNeedsParse,
  parseNotRequired,
  parseStageMessage,
  parseStatusLabel,
} from "../lib/attachmentParseProgress";
import "./ComposerStagedChips.css";

type Props = {
  attachments: readonly PreparedAttachment[];
  libraryById?: ReadonlyMap<string, ChatAttachmentPublic>;
  onRemove: (id: string) => void;
  onChipClick?: (attachment: ChatAttachmentPublic) => void;
};

function AttachmentIcon({ mediaType }: { mediaType: string }) {
  if (isImageMime(mediaType)) {
    return <ImageIcon size={14} strokeWidth={2} aria-hidden />;
  }
  return <FileText size={14} strokeWidth={2} aria-hidden />;
}

function toDrawerAttachment(
  staged: PreparedAttachment,
  libraryRow?: ChatAttachmentPublic,
): ChatAttachmentPublic {
  if (libraryRow) return libraryRow;
  return {
    id: staged.platformId ?? staged.id,
    chatId: staged.platformChatId ?? "",
    filename: staged.filename,
    mediaType: staged.mediaType,
    sizeBytes: staged.sizeBytes,
    createdAt: new Date().toISOString(),
  };
}

function resolveChipParseBadge(
  attachment: PreparedAttachment,
  libraryRow?: ChatAttachmentPublic,
): {
  label: string | null;
  detail: string | null;
  busy: boolean;
  failed: boolean;
} {
  if (attachment.uploadState === "uploading" || attachment.uploadState === "local") {
    return {
      label: attachment.uploadState === "local" ? "Pending upload" : "Uploading",
      detail: null,
      busy: true,
      failed: false,
    };
  }
  if (attachment.uploadState === "error") {
    return { label: null, detail: null, busy: false, failed: true };
  }

  const row = libraryRow ?? toDrawerAttachment(attachment, libraryRow);
  const needsParse =
    libraryRow != null
      ? !parseNotRequired(libraryRow)
      : likelyNeedsParse(row as ChatAttachmentPublic);

  if (!needsParse) {
    return { label: null, detail: null, busy: false, failed: false };
  }

  if (!libraryRow && attachment.uploadState === "uploaded") {
    return {
      label: "Parsing",
      detail: "Loading parse status…",
      busy: true,
      failed: false,
    };
  }

  const status = effectiveParseStatus(row as ChatAttachmentPublic);
  if (status === "failed") {
    return {
      label: "Parse failed",
      detail:
        libraryRow?.parseErrorMessage ??
        "Open attachment details to retry parse.",
      busy: false,
      failed: true,
    };
  }

  if (attachmentParseInProgress(row as ChatAttachmentPublic)) {
    const detail = libraryRow ? parseStageMessage(libraryRow) : null;
    return {
      label: parseStatusLabel(row as ChatAttachmentPublic),
      detail,
      busy: true,
      failed: false,
    };
  }

  if (libraryRow && parseNotRequired(libraryRow)) {
    return { label: null, detail: null, busy: false, failed: false };
  }

  return {
    label: "Ready",
    detail: "Parse complete",
    busy: false,
    failed: false,
  };
}

export function ComposerStagedChips({
  attachments,
  libraryById,
  onRemove,
  onChipClick,
}: Props) {
  if (attachments.length === 0) return null;

  return (
    <div className="composer-staged" aria-label="Staged attachments">
      {attachments.map((attachment) => {
        const libraryRow = attachment.platformId
          ? libraryById?.get(attachment.platformId)
          : undefined;
        const parseBadge = resolveChipParseBadge(attachment, libraryRow);
        const clickable = Boolean(onChipClick);

        return (
          <span
            key={attachment.id}
            className={[
              "composer-staged-chip",
              clickable ? "composer-staged-chip-clickable" : "",
              parseBadge.busy ? "composer-staged-chip-busy" : "",
              parseBadge.failed ? "composer-staged-chip-failed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              type="button"
              className="composer-staged-chip-main"
              title={attachment.filename}
              disabled={!clickable}
              onClick={() =>
                onChipClick?.(toDrawerAttachment(attachment, libraryRow))
              }
            >
              <AttachmentIcon mediaType={attachment.mediaType} />
              <span className="composer-staged-name">{attachment.filename}</span>
            </button>
            <span className="composer-staged-size">
              {formatBytes(attachment.sizeBytes)}
            </span>
            {attachment.compressed ? (
              <span
                className="composer-staged-badge"
                title="Re-encoded as JPEG for multimodal model compatibility"
              >
                Optimized
              </span>
            ) : null}
            {parseBadge.label ? (
              <span
                className={[
                  "composer-staged-badge",
                  parseBadge.busy ? "composer-staged-badge-busy" : "",
                  parseBadge.failed ? "composer-staged-badge-error" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={parseBadge.detail ?? parseBadge.label}
              >
                {parseBadge.busy ? (
                  <Loader2
                    size={12}
                    className="composer-staged-badge-spinner"
                    aria-hidden
                  />
                ) : null}
                {parseBadge.label}
              </span>
            ) : null}
            {attachment.uploadState === "error" ? (
              <span
                className="composer-staged-badge composer-staged-badge-error"
                title={attachment.uploadError ?? "Upload failed"}
              >
                {attachment.uploadError?.trim()
                  ? attachment.uploadError.length > 36
                    ? `${attachment.uploadError.slice(0, 33)}…`
                    : attachment.uploadError
                  : "Upload failed"}
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
