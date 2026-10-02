import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MessageStreamEvent } from "eve/client";
import type { EveMessage, EveMessagePart } from "eve/react";
import type { ArtifactSpec } from "@fde/artifact-spec";
import { resolveArtifactToolPart } from "@fde/artifact-ui";
import { ChevronRight, FileText, ImageIcon, Loader2 } from "lucide-react";
import { formatBytes, isImageMime } from "../lib/attachments";
import {
  ATTACHMENT_PARSE_POLL_MS,
  attachmentNeedsParsePoll,
  attachmentParseInProgress,
  parseNotRequired,
  parseStageMessage,
  parseStatusLabel,
} from "../lib/attachmentParseProgress";
import {
  fetchMentionAttachments,
  type ChatAttachmentPublic,
} from "../lib/attachmentUpload";
import type { UserMessageAttachmentHint } from "../lib/sentMessageAttachments";
import {
  attachmentIdsFromMessageParts,
  collapseUserClientContextMessages,
  userVisibleTextFromParts,
  workspaceFileIdsFromMessageParts,
} from "../lib/userMessageAttachments";
import type { WorkspaceFilePublic } from "../lib/workspace";
import { workspaceFileAsAttachmentRow } from "../lib/workspaceParse";
import type { AudioCapturePublic } from "../lib/audioCapture";
import {
  buildChatTimeline,
  captureIdsInPlatformStream,
} from "../lib/platformProductTurns";
import { AudioCaptureUserBubble } from "./AudioCaptureUserBubble";
import { AudioTranscriptResultCard } from "./AudioTranscriptResultCard";
import { MarkdownContent } from "./MarkdownContent";
import { StreamingIndicator } from "./StreamingIndicator";
import "./MessageStream.css";

type Props = {
  messages: readonly EveMessage[];
  streaming?: boolean;
  apiBase: string;
  token?: string | null;
  chatId?: string | null;
  eveSessionId?: string | null;
  userMessageAttachmentHints?: ReadonlyMap<
    string,
    readonly UserMessageAttachmentHint[]
  >;
  previewArtifactId?: string | null;
  onPreviewArtifact?: (spec: ArtifactSpec) => void;
  events?: readonly MessageStreamEvent[];
  audioCaptures?: readonly AudioCapturePublic[];
  onRetryAudioCapture?: (chatId: string, captureId: string) => void | Promise<void>;
  onOpenAttachmentPipeline?: (attachment: ChatAttachmentPublic) => void;
  workspaceFilesById?: ReadonlyMap<string, WorkspaceFilePublic>;
  emptyState?: ReactNode;
};

function StepChevron() {
  return (
    <ChevronRight
      size={14}
      strokeWidth={2}
      className="msg-step-chevron"
      aria-hidden
    />
  );
}

function PartView({
  part,
  apiBase,
  token,
  chatId,
  previewArtifactId,
  onPreviewArtifact,
}: {
  part: EveMessagePart;
  apiBase: string;
  token?: string | null;
  chatId?: string | null;
  previewArtifactId?: string | null;
  onPreviewArtifact?: (spec: ArtifactSpec) => void;
}) {
  if (part.type === "text") {
    return <MarkdownContent text={part.text} className="msg-text" />;
  }
  if (part.type === "reasoning") {
    return (
      <details className="msg-step">
        <summary>
          <StepChevron />
          <span>Reasoning</span>
        </summary>
        <MarkdownContent text={part.text} />
      </details>
    );
  }
  if (part.type === "dynamic-tool") {
    const name = "toolName" in part ? String(part.toolName) : "tool";
    const state = "state" in part ? String(part.state) : "";
    const output = "output" in part ? part.output : null;
    const artifactView =
      output != null
        ? resolveArtifactToolPart({
            toolName: name,
            output,
            apiBase,
            token,
            chatId,
            previewArtifactId,
            onPreview: onPreviewArtifact,
          })
        : null;

    if (artifactView) {
      return <div className="msg-artifact">{artifactView}</div>;
    }

    return (
      <details className="msg-step" open={state === "input-streaming"}>
        <summary>
          <StepChevron />
          <span className="step-check">✓</span>
          <span>{name}</span>
        </summary>
        {"input" in part && part.input != null ? (
          <pre>{JSON.stringify(part.input, null, 2)}</pre>
        ) : null}
        {output != null ? (
          <pre className="tool-out">{JSON.stringify(output, null, 2)}</pre>
        ) : null}
      </details>
    );
  }
  if (part.type === "step-start") {
    return null;
  }
  if (part.type === "file") {
    const label = part.filename ?? part.mediaType ?? "attachment";
    const isImage = part.mediaType ? isImageMime(part.mediaType) : false;
    const previewUrl =
      typeof part.url === "string" &&
      (part.url.startsWith("data:") || part.url.startsWith("http"))
        ? part.url
        : null;

    return (
      <div className="msg-file-chip">
        {isImage && previewUrl ? (
          <img
            className="msg-file-thumb"
            src={previewUrl}
            alt={label}
            loading="lazy"
          />
        ) : isImage ? (
          <ImageIcon size={16} strokeWidth={2} aria-hidden />
        ) : (
          <FileText size={16} strokeWidth={2} aria-hidden />
        )}
        <span className="msg-file-label">{label}</span>
        {"size" in part && typeof part.size === "number" ? (
          <span className="msg-file-size">{formatBytes(part.size)}</span>
        ) : null}
      </div>
    );
  }
  return null;
}

function UserAttachmentChip({
  filename,
  sizeBytes,
  libraryRow,
  sourceLabel,
  stale,
}: {
  filename: string;
  sizeBytes?: number;
  libraryRow?: ChatAttachmentPublic;
  sourceLabel?: string;
  stale?: boolean;
}) {
  const showParse =
    libraryRow != null && !parseNotRequired(libraryRow);
  const parseBusy = libraryRow != null && attachmentParseInProgress(libraryRow);
  const parseLabel = showParse && libraryRow ? parseStatusLabel(libraryRow) : null;
  const parseDetail =
    showParse && libraryRow ? parseStageMessage(libraryRow) : null;

  return (
    <span
      className={[
        "msg-user-attachment-chip",
        parseBusy ? "msg-user-attachment-chip-busy" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={parseDetail ?? filename}
    >
      <FileText size={14} strokeWidth={2} aria-hidden />
      <span className="msg-user-attachment-name">{filename}</span>
      {sourceLabel ? (
        <span className="msg-user-attachment-source">{sourceLabel}</span>
      ) : null}
      {stale ? (
        <span className="msg-user-attachment-stale">Unavailable</span>
      ) : null}
      {sizeBytes != null ? (
        <span className="msg-file-size">{formatBytes(sizeBytes)}</span>
      ) : null}
      {parseLabel ? (
        <span
          className={[
            "msg-user-attachment-parse-badge",
            parseBusy ? "msg-user-attachment-parse-badge-busy" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {parseBusy ? (
            <Loader2 size={11} className="msg-user-attachment-parse-spinner" aria-hidden />
          ) : null}
          {parseLabel}
        </span>
      ) : null}
    </span>
  );
}

export function MessageStream({
  messages,
  streaming = false,
  apiBase,
  token,
  chatId,
  eveSessionId = null,
  userMessageAttachmentHints,
  previewArtifactId,
  onPreviewArtifact,
  events,
  audioCaptures = [],
  onRetryAudioCapture,
  onOpenAttachmentPipeline,
  workspaceFilesById,
  emptyState,
}: Props) {
  const [libraryAttachments, setLibraryAttachments] = useState<
    ChatAttachmentPublic[]
  >([]);

  useEffect(() => {
    if (!token || (!chatId && !eveSessionId)) {
      setLibraryAttachments([]);
      return;
    }
    let cancelled = false;
    void fetchMentionAttachments({ chatId, eveSessionId })
      .then((items) => {
        if (!cancelled) setLibraryAttachments(items);
      })
      .catch(() => {
        /* keep prior library rows so sent-message attachment chips stay visible */
      });
    return () => {
      cancelled = true;
    };
  }, [chatId, eveSessionId, messages.length, token]);

  const shouldPollParse = useMemo(
    () => attachmentNeedsParsePoll(libraryAttachments),
    [libraryAttachments],
  );

  useEffect(() => {
    if (!token || (!chatId && !eveSessionId) || !shouldPollParse) return;
    let cancelled = false;
    const tick = () => {
      void fetchMentionAttachments({ chatId, eveSessionId })
        .then((items) => {
          if (!cancelled) setLibraryAttachments(items);
        })
        .catch(() => {
          /* ignore poll errors */
        });
    };
    const timer = window.setInterval(tick, ATTACHMENT_PARSE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [chatId, eveSessionId, shouldPollParse, token]);

  const libraryById = useMemo(() => {
    const map = new Map<string, ChatAttachmentPublic>();
    for (const row of libraryAttachments) map.set(row.id, row);
    return map;
  }, [libraryAttachments]);

  const displayMessages = useMemo(
    () => collapseUserClientContextMessages(messages),
    [messages],
  );

  const captureById = useMemo(() => {
    const map = new Map<string, AudioCapturePublic>();
    for (const row of audioCaptures) map.set(row.id, row);
    return map;
  }, [audioCaptures]);

  const legacyAudioCaptures = useMemo(() => {
    const inStream = captureIdsInPlatformStream(events);
    return audioCaptures.filter((c) => !inStream.has(c.id));
  }, [audioCaptures, events]);

  const timeline = useMemo(
    () => buildChatTimeline({ displayMessages, events }),
    [displayMessages, events],
  );

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const streamingOnAssistant =
    streaming && lastMessage?.role === "assistant";
  const streamingPending =
    streaming && (!lastMessage || lastMessage.role === "user");

  const hasAudioTurns =
    legacyAudioCaptures.length > 0 ||
    timeline.some((row) => row.type === "platform_audio");

  if (messages.length === 0 && !streaming && !hasAudioTurns) {
    if (emptyState) {
      return <div className="msg-empty msg-empty-custom">{emptyState}</div>;
    }
    return (
      <div className="msg-empty">
        Send a message to start collaborating with this agent.
      </div>
    );
  }

  const lastTimelineMessageIndex = timeline.reduce(
    (acc, row, index) => (row.type === "message" ? index : acc),
    -1,
  );

  function renderAudioCaptureTurn(capture: AudioCapturePublic) {
    return (
      <div key={capture.id} className="msg-audio-capture-turn">
        <div className="msg-row user">
          <div className="msg-bubble user">
            <AudioCaptureUserBubble capture={capture} />
          </div>
        </div>
        <div className="msg-row assistant">
          <div className="msg-assistant">
            <div className="msg-artifact">
              <AudioTranscriptResultCard
                capture={capture}
                chatId={capture.chatId}
                onOpenPipeline={onOpenAttachmentPipeline}
                onPreviewArtifact={onPreviewArtifact}
                onRetry={
                  onRetryAudioCapture
                    ? () => onRetryAudioCapture(capture.chatId, capture.id)
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="msg-stream">
      {timeline.map((row, index) => {
        if (row.type === "platform_audio") {
          const capture = captureById.get(row.captureId);
          if (!capture) return null;
          return renderAudioCaptureTurn(capture);
        }

        const msg = row.message;
        const extraAttachmentIds = row.extraAttachmentIds;
        const extraWorkspaceFileIds = row.extraWorkspaceFileIds;
        const isLastAssistant =
          streamingOnAssistant && index === lastTimelineMessageIndex;

        if (msg.role === "user") {
          const fileParts = msg.parts.filter((p) => p.type === "file");
          const contextIds = [
            ...attachmentIdsFromMessageParts(msg.parts),
            ...extraAttachmentIds,
          ];
          const workspaceContextIds = [
            ...workspaceFileIdsFromMessageParts(msg.parts),
            ...extraWorkspaceFileIds,
          ];
          const seenWs = new Set<string>();
          const uniqueWorkspaceIds = workspaceContextIds.filter((id) => {
            if (seenWs.has(id)) return false;
            seenWs.add(id);
            return true;
          });
          const seenFileLabels = new Set(
            fileParts.map((p) =>
              p.type === "file" ? (p.filename ?? "").toLowerCase() : "",
            ),
          );
          const hinted = userMessageAttachmentHints?.get(msg.id) ?? [];
          const hintedIds = new Set(hinted.map((row) => row.attachmentId));

          const contextChips = contextIds
            .map((id) => libraryById.get(id))
            .filter((row): row is ChatAttachmentPublic => Boolean(row))
            .filter((row) => !seenFileLabels.has(row.filename.toLowerCase()))
            .filter((row) => !hintedIds.has(row.id));

          const hintChips = hinted.filter(
            (row) => !seenFileLabels.has(row.filename.toLowerCase()),
          );

          const visibleText = userVisibleTextFromParts(msg.parts);
          const workspaceChips = uniqueWorkspaceIds.map((id) => {
            const file = workspaceFilesById?.get(id);
            const row = file ? workspaceFileAsAttachmentRow(file) : undefined;
            return {
              id,
              filename: file?.filename ?? "Workspace file",
              sizeBytes: file?.sizeBytes,
              libraryRow: row,
              stale: !file,
            };
          });

          const showAttachments =
            fileParts.length > 0 ||
            contextChips.length > 0 ||
            hintChips.length > 0 ||
            workspaceChips.length > 0;

          return (
            <div key={msg.id} className="msg-row user">
              <div className="msg-bubble user">
                {showAttachments ? (
                  <div className="msg-user-attachments">
                    {fileParts.map((part, i) => (
                      <PartView
                        key={`file-${i}`}
                        part={part}
                        apiBase={apiBase}
                        token={token}
                        chatId={chatId}
                        previewArtifactId={previewArtifactId}
                        onPreviewArtifact={onPreviewArtifact}
                      />
                    ))}
                    {hintChips.map((row) => (
                      <UserAttachmentChip
                        key={row.attachmentId}
                        filename={row.filename}
                        sizeBytes={row.sizeBytes}
                        libraryRow={libraryById.get(row.attachmentId)}
                      />
                    ))}
                    {contextChips.map((row) => (
                      <UserAttachmentChip
                        key={row.id}
                        filename={row.filename}
                        sizeBytes={row.sizeBytes}
                        libraryRow={row}
                      />
                    ))}
                    {workspaceChips.map((row) => (
                      <UserAttachmentChip
                        key={`ws-${row.id}`}
                        filename={row.filename}
                        sizeBytes={row.sizeBytes}
                        libraryRow={row.libraryRow}
                        sourceLabel="Workspace"
                        stale={row.stale}
                      />
                    ))}
                  </div>
                ) : null}
                {visibleText ? <MarkdownContent text={visibleText} /> : null}
              </div>
            </div>
          );
        }

        return (
          <div key={msg.id} className="msg-row assistant">
            <div className="msg-assistant">
              {msg.parts.map((part, i) => (
                <PartView
                  key={i}
                  part={part}
                  apiBase={apiBase}
                  token={token}
                  chatId={chatId}
                  previewArtifactId={previewArtifactId}
                  onPreviewArtifact={onPreviewArtifact}
                />
              ))}
              {isLastAssistant ? <StreamingIndicator /> : null}
            </div>
          </div>
        );
      })}
      {legacyAudioCaptures.map((capture) => renderAudioCaptureTurn(capture))}
      {streamingPending ? (
        <div className="msg-row assistant">
          <div className="msg-assistant">
            <StreamingIndicator />
          </div>
        </div>
      ) : null}
    </div>
  );
}
