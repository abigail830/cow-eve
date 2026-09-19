import { useCallback, useEffect, useState } from "react";
import { useEveAgent } from "eve/react";
import type { ClientSessionState } from "eve/client";
import {
  deleteChat,
  fetchChat,
  fetchChats,
  fetchModelSettings,
  type AgentInfo,
  type ChatSummary,
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

type BoundSession = {
  chatId: string | null;
  session: ClientSessionState | undefined;
  events: readonly unknown[] | undefined;
  resume: boolean;
  key: string;
};

export function AgentChat({ agent }: Props) {
  const { token } = useAuth();
  const [model, setModel] = useState<ModelSettingsPublic | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [bound, setBound] = useState<BoundSession>(() => ({
    chatId: null,
    session: undefined,
    events: undefined,
    resume: false,
    key: `new-${agent.id}`,
  }));

  const refreshChats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchChats(agent.id);
      setChats(res.chats);
      setHistoryError(null);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "Failed to load history",
      );
    }
  }, [agent.id, token]);

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

  useEffect(() => {
    setActiveChatId(null);
    setBound({
      chatId: null,
      session: undefined,
      events: undefined,
      resume: false,
      key: `new-${agent.id}-${Date.now()}`,
    });
    void refreshChats();
  }, [agent.id, refreshChats]);

  const startNewChat = () => {
    setActiveChatId(null);
    setBound({
      chatId: null,
      session: undefined,
      events: undefined,
      resume: false,
      key: `new-${agent.id}-${Date.now()}`,
    });
  };

  const openChat = async (chatId: string) => {
    try {
      const res = await fetchChat(chatId);
      setActiveChatId(chatId);
      setBound({
        chatId,
        session: {
          sessionId: res.chat.eveSessionId,
          streamIndex: 0,
        },
        events: undefined,
        resume: true,
        key: `chat-${chatId}`,
      });
      setHistoryError(null);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "Failed to open chat",
      );
    }
  };

  const removeChat = async (chatId: string) => {
    try {
      await deleteChat(chatId);
      if (activeChatId === chatId) startNewChat();
      await refreshChats();
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "Failed to delete chat",
      );
    }
  };

  const modelLabel = model?.displayName || model?.modelId || "Configure model";

  return (
    <div className="agent-chat">
      <AgentChatSession
        key={bound.key}
        agent={agent}
        token={token}
        model={model}
        modelLabel={modelLabel}
        chats={chats}
        historyError={historyError}
        activeChatId={activeChatId}
        bound={bound}
        onNewChat={startNewChat}
        onOpenChat={openChat}
        onDeleteChat={removeChat}
        onRefreshChats={refreshChats}
      />
    </div>
  );
}

type SessionProps = {
  agent: AgentInfo;
  token: string | null;
  model: ModelSettingsPublic | null;
  modelLabel: string;
  chats: ChatSummary[];
  historyError: string | null;
  activeChatId: string | null;
  bound: BoundSession;
  onNewChat: () => void;
  onOpenChat: (chatId: string) => Promise<void> | void;
  onDeleteChat: (chatId: string) => Promise<void> | void;
  onRefreshChats: () => void;
};

function AgentChatSession({
  agent,
  token,
  model,
  modelLabel,
  chats,
  historyError,
  activeChatId,
  bound,
  onNewChat,
  onOpenChat,
  onDeleteChat,
  onRefreshChats,
}: SessionProps) {
  const host = agentHost(agent.id);
  const { data, status, error, send, cancel } = useEveAgent({
    host,
    auth: token ? { bearer: () => token } : undefined,
    initialSession: bound.session,
    initialEvents: bound.events as never,
    resume: bound.resume,
    onSessionChange: () => {
      onRefreshChats();
    },
    onFinish: () => {
      onRefreshChats();
    },
  });

  const busy = status === "streaming" || status === "submitted";

  return (
    <>
      <header className="chat-header">
        <div className="chat-header-left">
          <img src={agent.avatar} alt="" width={36} height={36} />
          <div>
            <h2>{agent.displayName}</h2>
            <p>{agent.description}</p>
          </div>
        </div>
        <div className="chat-header-actions">
          <button type="button" title="New chat" onClick={onNewChat}>
            +
          </button>
        </div>
      </header>

      <div className="chat-workspace">
        <aside className="chat-history">
          <div className="chat-history-label">HISTORY</div>
          {historyError ? (
            <p className="chat-history-error">{historyError}</p>
          ) : null}
          {chats.length === 0 && !historyError ? (
            <p className="chat-history-empty">No saved chats yet</p>
          ) : null}
          <ul className="chat-history-list">
            {chats.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  className={
                    chat.id === activeChatId
                      ? "chat-history-item active"
                      : "chat-history-item"
                  }
                  onClick={() => void onOpenChat(chat.id)}
                >
                  <span className="chat-history-title">{chat.title}</span>
                  <span className="chat-history-time">
                    {new Date(chat.updatedAt).toLocaleString()}
                  </span>
                </button>
                <button
                  type="button"
                  className="chat-history-delete"
                  title="Delete"
                  onClick={() => void onDeleteChat(chat.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>

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
      </div>

      <Composer
        disabled={busy || !token}
        statusLabel={busy ? status : modelLabel}
        onSend={(text) => {
          void send(text);
        }}
        onCancel={busy ? () => void cancel() : undefined}
      />
    </>
  );
}
