import { useState } from "react";
import { Check, Circle, ImageIcon, Loader2, Minus, RotateCcw, X } from "lucide-react";
import type { ChatAttachmentPublic } from "../lib/attachmentUpload";
import {
  PARSE_STAGE_ORDER,
  buildStageStatuses,
  buildStageTelemetry,
  effectiveParseStatus,
  isImageAttachmentRow,
  parseNotRequired,
  parseNotRequiredDetail,
  parseProgressMessage,
  parseProgressMessageTone,
  parseStatusDisplayLabel,
  stageTimingLabel,
  type ParseStageDisplayStatus,
  type ParseStageId,
} from "../lib/attachmentParseProgress";
import { formatBytes } from "../lib/attachments";
import "./AttachmentParseDrawer.css";

const STAGE_LABELS: Record<ParseStageId, string> = {
  fetch: "Fetch source",
  analyze: "Analyze file",
  parse_submit: "Submit parse",
  parse_wait: "Wait for parser",
  parse_collect: "Collect output",
  normalize: "Normalize",
  write: "Write artifacts",
  finalize: "Finalize",
};

const STAGE_STATUS_LABELS: Record<ParseStageDisplayStatus, string> = {
  pending: "waiting",
  running: "running",
  succeeded: "done",
  failed: "failed",
  skipped: "skipped",
};

function stageNodeClass(status: ParseStageDisplayStatus, active: boolean): string {
  const classes = ["parse-pipeline-node", `parse-pipeline-node-${status}`];
  if (active) classes.push("parse-pipeline-node-active");
  return classes.join(" ");
}

function StageIcon({ status }: { status: ParseStageDisplayStatus }) {
  if (status === "running") {
    return <Loader2 size={12} className="parse-pipeline-node-spinner" aria-hidden />;
  }
  if (status === "succeeded") return <Check size={12} aria-hidden />;
  if (status === "failed") return <X size={12} aria-hidden />;
  if (status === "skipped") return <Minus size={12} aria-hidden />;
  return <Circle size={8} aria-hidden />;
}

type Props = {
  attachment: ChatAttachmentPublic | null;
  onClose: () => void;
  onRetry?: (attachment: ChatAttachmentPublic) => Promise<void>;
};

export function AttachmentParseDrawer({ attachment, onClose, onRetry }: Props) {
  const [retrying, setRetrying] = useState(false);

  if (!attachment) return null;

  const notRequired = parseNotRequired(attachment);
  const status = effectiveParseStatus(attachment);
  const statusLabel = parseStatusDisplayLabel(attachment);
  const stageStatuses = buildStageStatuses(attachment);
  const stageTelemetry = buildStageTelemetry(attachment);
  const progressMessage = parseProgressMessage(attachment);
  const progressTone = parseProgressMessageTone(attachment);
  const notRequiredDetail = parseNotRequiredDetail(attachment);
  const canRetry = Boolean(onRetry) && !notRequired && status === "failed";

  async function handleRetry() {
    const row = attachment;
    if (!onRetry || retrying || !row) return;
    setRetrying(true);
    try {
      await onRetry(row);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <>
      <div
        className="attachment-parse-drawer-backdrop"
        role="presentation"
        onClick={onClose}
      />
      <aside
        className="attachment-parse-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Parse status for ${attachment.filename}`}
      >
        <header className="attachment-parse-drawer-header">
          <div>
            <h3 className="attachment-parse-drawer-title">{attachment.filename}</h3>
            <p className="attachment-parse-drawer-meta">
              {formatBytes(attachment.sizeBytes)} · {statusLabel}
              {attachment.parsePipelineId
                ? ` · ${attachment.parsePipelineId}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            className="attachment-parse-drawer-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        {notRequired ? (
          <div className="attachment-parse-drawer-not-required" role="status">
            <span className="attachment-parse-drawer-not-required-icon" aria-hidden>
              {isImageAttachmentRow(attachment) ? (
                <ImageIcon size={20} />
              ) : (
                <Check size={20} />
              )}
            </span>
            <p className="attachment-parse-drawer-not-required-text">
              {notRequiredDetail}
            </p>
          </div>
        ) : (
          <>
            {progressMessage ? (
              <p
                className={[
                  "attachment-parse-drawer-message",
                  progressTone === "warning"
                    ? "attachment-parse-drawer-message-warning"
                    : "",
                  progressTone === "error"
                    ? "attachment-parse-drawer-message-error"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {progressMessage}
              </p>
            ) : null}

            {canRetry ? (
              <div className="attachment-parse-drawer-actions">
                <button
                  type="button"
                  className="attachment-parse-drawer-retry"
                  disabled={retrying}
                  onClick={() => void handleRetry()}
                >
                  {retrying ? (
                    <Loader2
                      size={14}
                      className="parse-pipeline-node-spinner"
                      aria-hidden
                    />
                  ) : (
                    <RotateCcw size={14} aria-hidden />
                  )}
                  {retrying ? "Retrying…" : "Retry parse"}
                </button>
                <p className="attachment-parse-drawer-retry-hint">
                  Re-runs the full pipeline from fetch. Partial step resume is not
                  supported yet.
                </p>
              </div>
            ) : null}

            <ol className="parse-pipeline-track" aria-label="Parse pipeline stages">
              {PARSE_STAGE_ORDER.map((stageId) => {
                const stageStatus = stageStatuses.get(stageId) ?? "pending";
                const active = stageStatus === "running";
                const telemetry = stageTelemetry.get(stageId);
                const timingLabel = stageTimingLabel(telemetry, stageStatus);
                return (
                  <li key={stageId} className={stageNodeClass(stageStatus, active)}>
                    <span className="parse-pipeline-node-rail" aria-hidden>
                      <span className="parse-pipeline-node-dot">
                        <StageIcon status={stageStatus} />
                      </span>
                    </span>
                    <div className="parse-pipeline-node-body">
                      <span className="parse-pipeline-node-label">
                        {STAGE_LABELS[stageId]}
                      </span>
                      <span className="parse-pipeline-node-id">{stageId}</span>
                      <span className="parse-pipeline-node-status">
                        {STAGE_STATUS_LABELS[stageStatus]}
                      </span>
                      {timingLabel ? (
                        <span className="parse-pipeline-node-timing">
                          {stageStatus === "running"
                            ? `${timingLabel}…`
                            : timingLabel}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </aside>
    </>
  );
}
