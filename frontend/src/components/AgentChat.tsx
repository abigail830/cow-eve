import { useCallback, useEffect, useRef, useState } from "react";
import type { ArtifactSpec } from "@fde/artifact-spec";
import { ArtifactPreviewModal } from "@fde/artifact-ui";
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
import { API_URL, agentHost } from "../lib/config";
import { resolveHistorySession } from "../lib/chat-stream";
import { useAuth } from "../lib/auth";
import { Composer } from "./Composer";
import { IconButton } from "./IconButton";
import { MemoryPanel } from "./MemoryPanel";
import { MessageStream } from "./MessageStream";
import "./AgentChat.css";

type Props = {
  agent: AgentInfo;
  /** When re-selecting this agent, reopen this chat (parent remembers per agent). */
  restoreChatId?: string | null;
  onActiveChatChange?: (chatId: string | null) => void;
  onStreamingChange?: (streaming: boolean) => void;
};

type BoundSession = {
  chatId: string | null;
  session: ClientSessionState | undefined;
  events: readonly MessageStreamEvent[] | undefined;
  resume: boolean;
  key: string;
};

export function AgentChat({
  agent,
  restoreChatId = null,
  onActiveChatChange,
  onStreamingChange,
}: Props) {
  const { token } = useAuth();
  const [model, setModel] = useState<ModelSettingsPublic | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
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

  const syncActiveChat = useCallback(
    (chatId: string | null) => {
      setActiveChatId(chatId);
      onActiveChatChange?.(chatId);
    },
    [onActiveChatChange],
  );

  const bindChat = useCallback(
    async (chatId: string, cancelled?: () => boolean) => {
      setLoadingChatId(chatId);
      setActiveChatId(chatId);
      try {
        const res = await fetchChat(chatId);
        if (cancelled?.()) return;
        const events = res.chat.events as MessageStreamEvent[];
        const history = resolveHistorySession({
          eveSessionId: res.chat.eveSessionId,
          streamIndex: res.chat.streamIndex,
          events,
        });
        setBound({
          chatId,
          session: history.session,
          events: history.events,
          resume: history.resume,
          key: `chat-${chatId}`,
        });
        syncActiveChat(chatId);
        setHistoryError(null);
      } catch (err) {
        if (cancelled?.()) return;
        syncActiveChat(null);
        setHistoryError(
          err instanceof Error ? err.message : "Failed to open chat",
        );
      } finally {
        if (!cancelled?.()) setLoadingChatId(null);
      }
    },
    [syncActiveChat],
  );

  useEffect(() => {
    let cancelled = false;
    const chatToRestore = restoreChatId;

    setActiveChatId(null);
    setBound({
      chatId: null,
      session: undefined,
      events: undefined,
      resume: false,
      key: `new-${agent.id}-${Date.now()}`,
    });

    void (async () => {
      if (!token) return;
      try {
        const res = await fetchChats(agent.id);
        if (cancelled) return;
        setChats(res.chats);
        setHistoryError(null);

        if (
          chatToRestore &&
          res.chats.some((chat) => chat.id === chatToRestore)
        ) {
          await bindChat(chatToRestore, () => cancelled);
        } else if (chatToRestore) {
          syncActiveChat(null);
        }
      } catch (err) {
        if (cancelled) return;
        setHistoryError(
          err instanceof Error ? err.message : "Failed to load history",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // restoreChatId intentionally omitted: only restore on agent switch, not when
    // the parent map updates while this agent stays mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capture restoreChatId at agent switch
  }, [agent.id, token, bindChat, syncActiveChat]);

  const startNewChat = () => {
    syncActiveChat(null);
    setBound({
      chatId: null,
      session: undefined,
      events: undefined,
      resume: false,
      key: `new-${agent.id}-${Date.now()}`,
    });
  };

  const openChat = async (chatId: string) => {
    await bindChat(chatId);
  };

  const removeChat = async (chatId: string) => {
    setDeletingChatId(chatId);
    setHistoryError(null);
    try {
      await deleteChat(chatId);
      if (activeChatId === chatId) startNewChat();
      await refreshChats();
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "Failed to delete chat",
      );
      throw err;
    } finally {
      setDeletingChatId(null);
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
      deletingChatId={deletingChatId}
      bound={bound}
      onNewChat={startNewChat}
      onOpenChat={openChat}
      onDeleteChat={removeChat}
      onRefreshChats={refreshChats}
      onActiveChatChange={syncActiveChat}
      onStreamingChange={onStreamingChange}
    />
  );
}

type SessionProps = {
  agent: AgentInfo;
  token: string | null;
  model: ModelSettingsPublic | null;
  modelLabel: string;
  onStreamingChange?: (streaming: boolean) => void;
  chats: ChatSummary[];
  historyError: string | null;
  activeChatId: string | null;
  loadingChatId: string | null;
  deletingChatId: string | null;
  bound: BoundSession;
  onNewChat: () => void;
  onOpenChat: (chatId: string) => Promise<void> | void;
  onDeleteChat: (chatId: string) => Promise<void>;
  onRefreshChats: () => void;
  onActiveChatChange?: (chatId: string | null) => void;
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
  deletingChatId,
  bound,
  onNewChat,
  onOpenChat,
  onDeleteChat,
  onRefreshChats,
  onActiveChatChange,
  onStreamingChange,
}: SessionProps) {
  const [previewArtifact, setPreviewArtifact] = useState<ArtifactSpec | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memory, setMemory] = useState<UserMemorySnapshot | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [cancellationError, setCancellationError] = useState<string>();
  const [sendError, setSendError] = useState<string>();
  /** True after cancel() is accepted until the stream settles. */
  const [cancelling, setCancelling] = useState(false);
  const [pendingDeleteChat, setPendingDeleteChat] = useState<ChatSummary | null>(
    null,
  );
  // eve fires onSessionChange for every stream event; only refresh when the
  // durable session id actually changes (new chat), plus once on turn finish.
  const knownSessionIdRef = useRef(bound.session?.sessionId);

  const host = agentHost(agent.id);
  const { data, status, error, events, session, send, cancel } = useEveAgent({
    host,
    auth: token ? { bearer: () => token } : undefined,
    initialSession: bound.session,
    initialEvents: bound.events,
    resume: bound.resume,
    onSessionChange: (session) => {
      const nextId = session?.sessionId;
      if (!nextId || nextId === knownSessionIdRef.current) return;
      knownSessionIdRef.current = nextId;
      onRefreshChats();
    },
    onFinish: () => {
      onRefreshChats();
    },
  });

  // Eve status contract (frontend overview + scaffold agent-chat):
  // - submitted | streaming → active turn: Stop calls cancel(); draft send uses steer
  // - resuming → catch-up only: no Stop, no send
  // - cancel keeps the stream attached through turn.cancelled → session.waiting
  const isBusy = status === "submitted" || status === "streaming";
  const isResuming = status === "resuming";
  const turnFailure =
    isBusy || isResuming ? undefined : latestTurnFailure(events);
  const errorMessage =
    cancellationError ?? sendError ?? error?.message ?? turnFailure;

  useEffect(() => {
    if (!isBusy) setCancelling(false);
  }, [isBusy]);

  // First message on a blank composer creates a chat row; remember it for restore.
  useEffect(() => {
    if (activeChatId || !session?.sessionId) return;
    const match = chats.find((chat) => chat.eveSessionId === session.sessionId);
    if (match) onActiveChatChange?.(match.id);
  }, [activeChatId, chats, onActiveChatChange, session?.sessionId]);

  useEffect(() => {
    onStreamingChange?.(isBusy);
    return () => {
      onStreamingChange?.(false);
    };
  }, [isBusy, onStreamingChange]);

  const requestCancellation = useCallback(() => {
    if (!isBusy || cancelling) return;
    setCancellationError(undefined);
    setSendError(undefined);
    setCancelling(true);
    // Fire-and-forget: cancel() resolves when Eve accepts the request (or
    // reports no active turn). Settlement arrives on the same stream.
    void cancel().catch((err: unknown) => {
      setCancelling(false);
      setCancellationError(
        err instanceof Error ? err.message : "Unable to cancel the response.",
      );
    });
  }, [cancel, cancelling, isBusy]);

  const handleSend = useCallback(
    (text: string) => {
      if (isResuming) return;
      setCancellationError(undefined);
      setSendError(undefined);
      // While a turn is active, steer at the next boundary instead of opening
      // a second turn (eve rejects plain send with "already processing").
      void send(text, isBusy ? { turnPolicy: "steer" } : undefined).catch(
        (err: unknown) => {
          setSendError(
            err instanceof Error ? err.message : "Failed to send message.",
          );
        },
      );
    },
    [isBusy, isResuming, send],
  );

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
                <MessageStream
                  messages={data.messages}
                  streaming={isBusy}
                  apiBase={API_URL}
                  token={token}
                  onPreviewArtifact={setPreviewArtifact}
                />
                {cancelling && isBusy ? (
                  <p className="chat-status" role="status">
                    Stopping… waiting for the turn to settle.
                  </p>
                ) : null}
                {errorMessage ? (
                  <p className="chat-error">{errorMessage}</p>
                ) : null}
              </>
            )}
          </div>
        </div>

        <Composer
          disabled={!token}
          modelLabel={modelLabel}
          busy={isBusy}
          resuming={isResuming}
          cancelling={cancelling}
          onSend={handleSend}
          onStop={requestCancellation}
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
                    disabled={
                      loadingChatId === chat.id || deletingChatId !== null
                    }
                    onClick={() => {
                      if (loadingChatId || deletingChatId) return;
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
                    aria-label={
                      deletingChatId === chat.id ? "Deleting chat" : "Delete chat"
                    }
                    aria-busy={deletingChatId === chat.id}
                    disabled={deletingChatId !== null}
                    onClick={() => setPendingDeleteChat(chat)}
                  >
                    {deletingChatId === chat.id ? (
                      <Loader2
                        size={15}
                        strokeWidth={2}
                        className="chat-history-delete-spinner"
                        aria-hidden
                      />
                    ) : (
                      <Trash2 size={15} strokeWidth={2} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      ) : null}

      {pendingDeleteChat ? (
        <DeleteChatDialog
          chatTitle={pendingDeleteChat.title}
          onCancel={() => setPendingDeleteChat(null)}
          onConfirm={() => {
            const chatId = pendingDeleteChat.id;
            setPendingDeleteChat(null);
            void onDeleteChat(chatId).catch(() => {
              /* historyError is set by parent */
            });
          }}
        />
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

      <ArtifactPreviewModal
        spec={previewArtifact}
        apiBase={API_URL}
        token={token}
        onClose={() => setPreviewArtifact(null)}
      />
    </div>
  );
}

function DeleteChatDialog({
  chatTitle,
  onCancel,
  onConfirm,
}: {
  chatTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="chat-delete-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="chat-delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="chat-delete-title"
        aria-describedby="chat-delete-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <h4 id="chat-delete-title">Delete conversation?</h4>
        <p id="chat-delete-desc">
          <strong>{chatTitle}</strong> will be permanently removed. This cannot
          be undone.
        </p>
        <div className="chat-delete-dialog-actions">
          <button
            type="button"
            className="chat-delete-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="chat-delete-confirm"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function latestTurnFailure(
  events: readonly MessageStreamEvent[],
): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === "turn.failed") {
      return event.data.code === "MODEL_CALL_FAILED"
        ? "The model is temporarily unavailable. Please try again."
        : event.data.message;
    }
    if (
      event?.type === "turn.completed" ||
      event?.type === "turn.cancelled" ||
      event?.type === "message.received"
    ) {
      return undefined;
    }
  }
  return undefined;
}
