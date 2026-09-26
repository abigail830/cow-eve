import { useEffect, useMemo, useState } from "react";
import type { EveMessage, EveMessagePart } from "eve/react";
import type { ArtifactSpec } from "@fde/artifact-spec";
import { resolveArtifactToolPart } from "@fde/artifact-ui";
import { ChevronRight, FileText, ImageIcon } from "lucide-react";
import { formatBytes, isImageMime } from "../lib/attachments";
import {
  fetchMentionAttachments,
  type ChatAttachmentPublic,
} from "../lib/attachmentUpload";
import type { UserMessageAttachmentHint } from "../lib/sentMessageAttachments";
import {
  attachmentIdsFromMessageParts,
  collapseUserClientContextMessages,
  userVisibleTextFromParts,
} from "../lib/userMessageAttachments";
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
}: {
  filename: string;
  sizeBytes?: number;
}) {
  return (
    <span className="msg-user-attachment-chip" title={filename}>
      <FileText size={14} strokeWidth={2} aria-hidden />
      <span className="msg-user-attachment-name">{filename}</span>
      {sizeBytes != null ? (
        <span className="msg-file-size">{formatBytes(sizeBytes)}</span>
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
        if (!cancelled) setLibraryAttachments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [chatId, eveSessionId, messages.length, token]);

  const libraryById = useMemo(() => {
    const map = new Map<string, ChatAttachmentPublic>();
    for (const row of libraryAttachments) map.set(row.id, row);
    return map;
  }, [libraryAttachments]);

  const displayMessages = useMemo(
    () => collapseUserClientContextMessages(messages),
    [messages],
  );

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const streamingOnAssistant =
    streaming && lastMessage?.role === "assistant";
  const streamingPending =
    streaming && (!lastMessage || lastMessage.role === "user");

  if (messages.length === 0 && !streaming) {
    return (
      <div className="msg-empty">
        Send a message to start collaborating with this agent.
      </div>
    );
  }

  return (
    <div className="msg-stream">
      {displayMessages.map(({ message: msg, extraAttachmentIds }, index) => {
        const isLastAssistant =
          streamingOnAssistant && index === displayMessages.length - 1;

        if (msg.role === "user") {
          const fileParts = msg.parts.filter((p) => p.type === "file");
          const contextIds = [
            ...attachmentIdsFromMessageParts(msg.parts),
            ...extraAttachmentIds,
          ];
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
          const showAttachments =
            fileParts.length > 0 ||
            contextChips.length > 0 ||
            hintChips.length > 0;

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
                      />
                    ))}
                    {contextChips.map((row) => (
                      <UserAttachmentChip
                        key={row.id}
                        filename={row.filename}
                        sizeBytes={row.sizeBytes}
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
