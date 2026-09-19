import { useEffect, useState } from "react";
import { useEveAgent } from "eve/react";
import {
  fetchModelSettings,
  type AgentInfo,
  type ModelSettingsPublic,
} from "../lib/api";
import { agentHost } from "../lib/config";
import { useAuth } from "../lib/auth";
import { Composer } from "./Composer";
import { MessageStream } from "./MessageStream";
import "./AgentChat.css";

type Props = {
  agent: AgentInfo;
};

export function AgentChat({ agent }: Props) {
  const { token } = useAuth();
  const host = agentHost(agent.id);
  const [model, setModel] = useState<ModelSettingsPublic | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchModelSettings()
      .then((res) => {
        if (!cancelled) setModel(res.settings);
      })
      .catch(() => {
        if (!cancelled) setModel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const { data, status, error, send, cancel, reset } = useEveAgent({
    host,
    auth: token ? { bearer: () => token } : undefined,
  });

  const busy = status === "streaming" || status === "submitted";
  const modelLabel = model?.displayName || model?.modelId || "Configure model";

  return (
    <div className="agent-chat">
      <header className="chat-header">
        <div className="chat-header-left">
          <img src={agent.avatar} alt="" width={36} height={36} />
          <div>
            <h2>{agent.displayName}</h2>
            <p>{agent.description}</p>
          </div>
        </div>
        <div className="chat-header-actions">
          <button type="button" title="New chat" onClick={() => reset()}>
            +
          </button>
        </div>
      </header>

      <div className="chat-body">
        {!model?.hasApiKey ? (
          <div className="chat-banner">
            Model API key is not set. Open Settings → Model to connect DeepSeek /
            Qwen (OpenAI-compatible).
          </div>
        ) : null}
        <MessageStream messages={data.messages} />
        {error ? <p className="chat-error">{error.message}</p> : null}
      </div>

      <Composer
        disabled={busy || !token}
        statusLabel={busy ? status : modelLabel}
        onSend={(text) => {
          void send(text);
        }}
        onCancel={busy ? () => void cancel() : undefined}
      />
    </div>
  );
}
