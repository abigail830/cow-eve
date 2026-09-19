import type { EveMessage, EveMessagePart } from "eve/react";
import type { ArtifactSpec } from "@fde/artifact-spec";
import { resolveArtifactToolPart } from "@fde/artifact-ui";
import { ChevronRight } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";
import { StreamingIndicator } from "./StreamingIndicator";
import "./MessageStream.css";

type Props = {
  messages: readonly EveMessage[];
  streaming?: boolean;
  apiBase: string;
  token?: string | null;
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
  onPreviewArtifact,
}: {
  part: EveMessagePart;
  apiBase: string;
  token?: string | null;
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
    return (
      <div className="msg-file">
        Attachment: {part.filename ?? part.mediaType}
      </div>
    );
  }
  return null;
}

export function MessageStream({
  messages,
  streaming = false,
  apiBase,
  token,
  onPreviewArtifact,
}: Props) {
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
      {messages.map((msg, index) => {
        const isLastAssistant =
          streamingOnAssistant && index === messages.length - 1;

        return (
          <div key={msg.id} className={`msg-row ${msg.role}`}>
            {msg.role === "user" ? (
              <div className="msg-bubble user">
                {msg.parts
                  .filter((p) => p.type === "text")
                  .map((p, i) =>
                    "text" in p ? (
                      <MarkdownContent key={i} text={p.text} />
                    ) : null,
                  )}
              </div>
            ) : (
              <div className="msg-assistant">
                {msg.parts.map((part, i) => (
                  <PartView
                    key={i}
                    part={part}
                    apiBase={apiBase}
                    token={token}
                    onPreviewArtifact={onPreviewArtifact}
                  />
                ))}
                {isLastAssistant ? <StreamingIndicator /> : null}
              </div>
            )}
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
