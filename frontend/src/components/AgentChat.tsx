import { useCallback, useEffect, useState } from "react";
import { useEveAgent } from "eve/react";
import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import {
  Brain,
  List,
  Loader2,
  MessageCirclePlus,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteChat,
  fetchChat,
  fetchChats,
  fetchMemory,
  fetchModelSettings,
  type AgentInfo,
  type ChatSummary,
  type ModelSettingsPublic,
  type UserMemorySnapshot,
} from "../lib/api";
import { agentHost } from "../lib/config";
import { useAuth } from "../lib/auth";
import { Composer } from "./Composer";
import { IconButton } from "./IconButton";
import { MemoryPanel } from "./MemoryPanel";
import { MessageStream } from "./MessageStream";
import "./AgentChat.css";

type Props = {
  agent: AgentInfo;
};

type BoundSession = {
  chatId: string | null;
  session: ClientSessionState | undefined;
  events: readonly MessageStreamEvent[] | undefined;
  resume: boolean;
  key: string;
};

export function AgentChat({ agent }: Props) {
  const { token } = useAuth();
  const [model, setModel] = useState<ModelSettingsPublic | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
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
    setLoadingChatId(chatId);
    setActiveChatId(chatId);
    try {
      const res = await fetchChat(chatId);
      const events = res.chat.events as MessageStreamEvent[];
      setBound({
        chatId,
        session: {
          sessionId: res.chat.eveSessionId,
          streamIndex: events.length,
        },
        events,
        resume: true,
        key: `chat-${chatId}`,
      });
      setHistoryError(null);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "Failed to open chat",
      );
    } finally {
      setLoadingChatId(null);
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
    <AgentChatSession
      key={bound.key}
      agent={agent}
      token={token}
      model={model}
      modelLabel={modelLabel}
      chats={chats}
      historyError={historyError}
      activeChatId={activeChatId}
      loadingChatId={loadingChatId}
      bound={bound}
      onNewChat={startNewChat}
      onOpenChat={openChat}
      onDeleteChat={removeChat}
      onRefreshChats={refreshChats}
    />
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
  loadingChatId: string | null;
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
  loadingChatId,
  bound,
  onNewChat,
  onOpenChat,
  onDeleteChat,
  onRefreshChats,
}: SessionProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memory, setMemory] = useState<UserMemorySnapshot | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  const host = agentHost(agent.id);
  const { data, status, error, send, cancel } = useEveAgent({
    host,
    auth: token ? { bearer: () => token } : undefined,
    initialSession: bound.session,
    initialEvents: bound.events,
    resume: bound.resume,
    onSessionChange: () => {
      onRefreshChats();
    },
    onFinish: () => {
      onRefreshChats();
    },
  });

  const busy =
    status === "streaming" || status === "submitted" || status === "resuming";

  const loadMemory = useCallback(async () => {
    if (!token) return;
    setMemoryLoading(true);
    setMemoryError(null);
    try {
      const res = await fetchMemory(agent.id);
      setMemory(res.memory);
    } catch (err) {
      setMemoryError(
        err instanceof Error ? err.message : "Failed to load memory",
      );
    } finally {
      setMemoryLoading(false);
    }
  }, [agent.id, token]);

  useEffect(() => {
    if (!memoryOpen) return;
    void loadMemory();
  }, [memoryOpen, loadMemory]);

  function closePanels() {
    setHistoryOpen(false);
    setMemoryOpen(false);
  }

  return (
    <div className="agent-chat">
      <div className="chat-main-column">
        <header className="chat-header">
          <div className="chat-header-left">
            <img src={agent.avatar} alt="" width={36} height={36} />
            <div>
              <h2>{agent.displayName}</h2>
              <p>{agent.description}</p>
            </div>
          </div>
          <div className="chat-header-actions">
            <IconButton
              bare
              size={22}
              icon={MessageCirclePlus}
              label="New conversation"
              onClick={() => {
                closePanels();
                onNewChat();
              }}
            />
            <IconButton
              bare
              size={22}
              icon={Brain}
              label="Memory"
              active={memoryOpen}
              onClick={() => {
                setHistoryOpen(false);
                setMemoryOpen((open) => !open);
              }}
            />
            <IconButton
              bare
              size={22}
              icon={List}
              label="Chat history"
              active={historyOpen}
              onClick={() => {
                setMemoryOpen(false);
                setHistoryOpen((open) => !open);
              }}
            />
          </div>
        </header>

        <div className="chat-body">
          <div className="chat-content-column">
            {loadingChatId ? (
              <div className="chat-loading" role="status" aria-live="polite">
                <Loader2
                  size={28}
                  strokeWidth={2}
                  className="chat-loading-spinner"
                  aria-hidden
                />
                <span>Loading conversation…</span>
              </div>
            ) : (
              <>
                {!model?.hasApiKey ? (
                  <div className="chat-banner">
                    Model API key is not set. Open Settings → Model to connect
                    DeepSeek / Qwen (OpenAI-compatible).
                  </div>
                ) : null}
                <MessageStream messages={data.messages} />
                {error ? <p className="chat-error">{error.message}</p> : null}
              </>
            )}
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
      </div>

      {historyOpen ? (
        <aside className="chat-history-panel">
          <div className="chat-history-panel-header">
            <h3>Chat History ({chats.length})</h3>
            <button
              type="button"
              className="chat-history-close"
              aria-label="Close"
              onClick={() => setHistoryOpen(false)}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="chat-history-panel-body">
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
                    disabled={loadingChatId === chat.id}
                    onClick={() => {
                      if (loadingChatId) return;
                      void onOpenChat(chat.id);
                    }}
                  >
                    <span className="chat-history-title">
                      {loadingChatId === chat.id ? (
                        <Loader2
                          size={14}
                          strokeWidth={2}
                          className="chat-history-spinner"
                          aria-hidden
                        />
                      ) : null}
                      {chat.title}
                    </span>
                    <span className="chat-history-time">
                      {new Date(chat.updatedAt).toLocaleString()}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="chat-history-delete"
                    title="Delete"
                    aria-label="Delete chat"
                    onClick={() => void onDeleteChat(chat.id)}
                  >
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      ) : null}

      {memoryOpen ? (
        <MemoryPanel
          agentName={agent.displayName}
          memory={memory}
          loading={memoryLoading}
          error={memoryError}
          onClose={() => setMemoryOpen(false)}
        />
      ) : null}
    </div>
  );
}
