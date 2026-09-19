import type { EveMessage, EveMessagePart } from "eve/react";
import "./MessageStream.css";

function PartView({ part }: { part: EveMessagePart }) {
  if (part.type === "text") {
    return <div className="msg-text">{part.text}</div>;
  }
  if (part.type === "reasoning") {
    return (
      <details className="msg-step">
        <summary>Reasoning</summary>
        <pre>{part.text}</pre>
      </details>
    );
  }
  if (part.type === "dynamic-tool") {
    const name = "toolName" in part ? String(part.toolName) : "tool";
    const state = "state" in part ? String(part.state) : "";
    return (
      <details className="msg-step" open={state === "input-streaming"}>
        <summary>
          <span className="step-check">✓</span> {name}
        </summary>
        {"input" in part && part.input != null ? (
          <pre>{JSON.stringify(part.input, null, 2)}</pre>
        ) : null}
        {"output" in part && part.output != null ? (
          <pre className="tool-out">{JSON.stringify(part.output, null, 2)}</pre>
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

export function MessageStream({ messages }: { messages: readonly EveMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="msg-empty">
        Send a message to start collaborating with this agent.
      </div>
    );
  }

  return (
    <div className="msg-stream">
      {messages.map((msg) => (
        <div key={msg.id} className={`msg-row ${msg.role}`}>
          {msg.role === "user" ? (
            <div className="msg-bubble user">
              {msg.parts
                .filter((p) => p.type === "text")
                .map((p, i) => (
                  <div key={i}>{"text" in p ? p.text : null}</div>
                ))}
            </div>
          ) : (
            <div className="msg-assistant">
              {msg.parts.map((part, i) => (
                <PartView key={i} part={part} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
