import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ArtifactSpec } from "@fde/artifact-spec";
import { ArtifactPreviewPanel } from "@fde/artifact-ui";
import { useEveAgent } from "eve/react";
import type { MessageStreamEvent } from "eve/client";
import {
  Brain,
  Clock,
  List,
  Loader2,
  MessageCirclePlus,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteChat,
  fetchChats,
  fetchMemory,
  fetchModelSettings,
  type AgentInfo,
  type ChatSummary,
  type ModelSettingsPublic,
  type UserMemorySnapshot,
} from "../lib/api";
import { API_URL, agentHost } from "../lib/config";
import { fetchBoundSession, type BoundSession } from "../lib/load-chat-session";
import { useAuth } from "../lib/auth";
import type { PreparedAttachment } from "../lib/attachments";
import { ensureAttachmentsUploaded } from "../lib/attachmentUpload";
import { buildMessageContent } from "../lib/attachmentSend";
import { Composer, type ComposerSendPayload } from "./Composer";
import { IconButton } from "./IconButton";
import { MemoryPanel } from "./MemoryPanel";
import { MessageStream } from "./MessageStream";
import { ResizableAside } from "./ResizableAside";
import { SchedulePanel } from "./SchedulePanel";
import "./AgentChat.css";
import "./SchedulePanel.css";

type Props = {
  agent: AgentInfo;
  /** When re-selecting this agent, reopen this chat (parent remembers per agent). */
  restoreChatId?: string | null;
  /** Omni only: show schedules in the main chat content area. */
  schedulesOpen?: boolean;
  onSchedulesOpenChange?: (open: boolean) => void;
  onActiveChatChange?: (chatId: string | null) => void;
  onStreamingChange?: (streaming: boolean) => void;
};

function AgentChatLoading({ agent }: { agent: AgentInfo }) {
  return (
    <div className="agent-chat">
      <div className="chat-main-column">
        <header className="chat-header">
          <div className="chat-header-left">
            <span className="chat-header-avatar">
              <img src={agent.avatar} alt="" />
            </span>
            <div className="chat-header-meta">
              <h2>{agent.displayName}</h2>
            </div>
          </div>
        </header>
        <div className="chat-body">
          <div className="chat-content-column">
            <div className="chat-loading" role="status" aria-live="polite">
              <Loader2
                size={28}
                strokeWidth={2}
                className="chat-loading-spinner"
                aria-hidden
              />
              <span>Loading conversation…</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentChat({
  agent,
  restoreChatId = null,
  schedulesOpen = false,
  onSchedulesOpenChange,
  onActiveChatChange,
  onStreamingChange,
}: Props) {
  const { token } = useAuth();
  const [model, setModel] = useState<ModelSettingsPublic | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [switchingChatId, setSwitchingChatId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  /** First restore: one DB fetch before mounting the eve session. */
  const [initialLoadDone, setInitialLoadDone] = useState(() => !restoreChatId);
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

  const onActiveChatChangeRef = useRef(onActiveChatChange);
  onActiveChatChangeRef.current = onActiveChatChange;

  const syncActiveChat = useCallback((chatId: string | null) => {
    setActiveChatId(chatId);
    onActiveChatChangeRef.current?.(chatId);
  }, []);

  const bindChat = useCallback(async (chatId: string) => {
    setSwitchingChatId(chatId);
    setActiveChatId(chatId);

    try {
      const next = await fetchBoundSession(chatId);
      setBound(next);
      syncActiveChat(chatId);
      setHistoryError(null);
    } catch (err) {
      syncActiveChat(null);
      setHistoryError(
        err instanceof Error ? err.message : "Failed to open chat",
      );
    } finally {
      setSwitchingChatId(null);
    }
  }, [syncActiveChat]);

  // Agent switch only — do NOT depend on bindChat/syncActiveChat (unstable → reload loop).
  useEffect(() => {
    let cancelled = false;
    const chatToRestore = restoreChatId;

    if (chatToRestore) {
      setInitialLoadDone(false);
      setActiveChatId(chatToRestore);
    } else {
      setInitialLoadDone(true);
      setSwitchingChatId(null);
      setActiveChatId(null);
      setBound({
        chatId: null,
        session: undefined,
        events: undefined,
        resume: false,
        key: `new-${agent.id}-${Date.now()}`,
      });
    }

    void (async () => {
      if (!token) return;

      const chatsTask = fetchChats(agent.id)
        .then((res) => {
          if (cancelled) return res;
          setChats(res.chats);
          setHistoryError(null);
          return res;
        })
        .catch((err: unknown) => {
          if (cancelled) throw err;
          setHistoryError(
            err instanceof Error ? err.message : "Failed to load history",
          );
          throw err;
        });

      if (chatToRestore) {
        try {
          const next = await fetchBoundSession(chatToRestore);
          if (cancelled) return;
          setBound(next);
          setActiveChatId(chatToRestore);
          onActiveChatChangeRef.current?.(chatToRestore);
          setHistoryError(null);
        } catch (err) {
          if (cancelled) return;
          setHistoryError(
            err instanceof Error ? err.message : "Failed to open chat",
          );
        } finally {
          if (!cancelled) setInitialLoadDone(true);
        }
        await chatsTask.catch(() => undefined);
        return;
      }

      await chatsTask.catch(() => undefined);
    })();

    return () => {
      cancelled = true;
    };
    // restoreChatId captured at agent switch — intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, token]);

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

  if (!initialLoadDone) {
    return <AgentChatLoading agent={agent} />;
  }

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
      switchingChatId={switchingChatId}
      deletingChatId={deletingChatId}
      bound={bound}
      onNewChat={startNewChat}
      onOpenChat={openChat}
      onDeleteChat={removeChat}
      onRefreshChats={refreshChats}
      onActiveChatChange={syncActiveChat}
      onStreamingChange={onStreamingChange}
      schedulesOpen={schedulesOpen}
      onSchedulesOpenChange={onSchedulesOpenChange}
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
  switchingChatId: string | null;
  deletingChatId: string | null;
  bound: BoundSession;
  onNewChat: () => void;
  onOpenChat: (chatId: string) => Promise<void> | void;
  onDeleteChat: (chatId: string) => Promise<void>;
  onRefreshChats: () => void;
  onActiveChatChange?: (chatId: string | null) => void;
  schedulesOpen: boolean;
  onSchedulesOpenChange?: (open: boolean) => void;
};

function AgentChatSession({
  agent,
  token,
  model,
  modelLabel,
  chats,
  historyError,
  activeChatId,
  switchingChatId,
  deletingChatId,
  bound,
  onNewChat,
  onOpenChat,
  onDeleteChat,
  onRefreshChats,
  onActiveChatChange,
  onStreamingChange,
  schedulesOpen,
  onSchedulesOpenChange,
}: SessionProps) {
  const isOmni = agent.id === "omni";
  const [previewArtifact, setPreviewArtifact] = useState<ArtifactSpec | null>(null);
  const lastPreviewArtifactRef = useRef<ArtifactSpec | null>(null);
  if (previewArtifact) lastPreviewArtifactRef.current = previewArtifact;
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
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const onStreamingChangeRef = useRef(onStreamingChange);
  onStreamingChangeRef.current = onStreamingChange;

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
  /** Legacy partial streams only — full history renders from initialEvents without blocking UI. */
  const conversationLoading =
    bound.resume &&
    bound.events === undefined &&
    data.messages.length === 0 &&
    (isResuming || status === "ready");
  const turnFailure =
    isBusy || isResuming ? undefined : latestTurnFailure(events);
  const errorMessage =
    cancellationError ?? sendError ?? error?.message ?? turnFailure;

  useEffect(() => {
    if (!isBusy) setCancelling(false);
  }, [isBusy]);

  // After opening/restoring a conversation, land at the latest messages.
  useLayoutEffect(() => {
    if (conversationLoading || data.messages.length === 0) return;
    const el = chatBodyRef.current;
    if (!el) return;
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
  }, [conversationLoading, bound.chatId, data.messages.length]);

  // First message on a blank composer creates a chat row; remember it for restore.
  useEffect(() => {
    if (activeChatId || !session?.sessionId) return;
    const match = chats.find((chat) => chat.eveSessionId === session.sessionId);
    if (match) onActiveChatChange?.(match.id);
  }, [activeChatId, chats, onActiveChatChange, session?.sessionId]);

  useEffect(() => {
    onStreamingChangeRef.current?.(isBusy);
    return () => {
      onStreamingChangeRef.current?.(false);
    };
  }, [isBusy]);

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

  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;

  const flushAttachmentLibrary = useCallback(
    async (items: readonly PreparedAttachment[]) => {
      if (!token || items.length === 0) return;
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const eveSessionId =
          knownSessionIdRef.current ?? session?.sessionId ?? null;
        const chatId = activeChatIdRef.current;
        if (eveSessionId || chatId) {
          await ensureAttachmentsUploaded(items, {
            chatId,
            eveSessionId,
            agentId: agent.id,
          });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    },
    [agent.id, session?.sessionId, token],
  );

  const handleSend = useCallback(
    async (payload: ComposerSendPayload) => {
      if (isResuming) return;
      const trimmed = payload.text.trim();
      if (!trimmed && payload.attachments.length === 0) return;

      setCancellationError(undefined);
      setSendError(undefined);

      let attachments = payload.attachments;
      const uploadTarget = {
        chatId: activeChatId,
        eveSessionId: session?.sessionId ?? knownSessionIdRef.current,
        agentId: agent.id,
      };

      try {
        if (
          token &&
          attachments.length > 0 &&
          (uploadTarget.chatId || uploadTarget.eveSessionId)
        ) {
          attachments = await ensureAttachmentsUploaded(
            attachments,
            uploadTarget,
          );
        }
      } catch (err) {
        setSendError(
          err instanceof Error ? err.message : "Failed to upload attachments.",
        );
        return;
      }

      const message =
        attachments.length > 0
          ? buildMessageContent(trimmed, attachments)
          : trimmed;
      const libraryBackup =
        token && payload.attachments.some((item) => !item.platformId)
          ? payload.attachments
          : null;

      // While a turn is active, steer at the next boundary instead of opening
      // a second turn (eve rejects plain send with "already processing").
      void send(message, isBusy ? { turnPolicy: "steer" } : undefined)
        .then(() => {
          if (libraryBackup) {
            void flushAttachmentLibrary(libraryBackup).catch((err: unknown) => {
              console.warn("[attachments] post-send library flush failed", err);
            });
          }
        })
        .catch((err: unknown) => {
          setSendError(
            err instanceof Error ? err.message : "Failed to send message.",
          );
        });
    },
    [
      activeChatId,
      agent.id,
      flushAttachmentLibrary,
      isBusy,
      isResuming,
      send,
      session?.sessionId,
      token,
    ],
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

  const handlePreviewArtifact = useCallback((spec: ArtifactSpec) => {
    setHistoryOpen(false);
    setMemoryOpen(false);
    setPreviewArtifact(spec);
  }, []);

  function closePanels() {
    setHistoryOpen(false);
    setMemoryOpen(false);
    setPreviewArtifact(null);
    onSchedulesOpenChange?.(false);
  }

  function openSchedulesPanel() {
    setPreviewArtifact(null);
    setHistoryOpen(false);
    setMemoryOpen(false);
    onSchedulesOpenChange?.(true);
  }

  return (
    <div className="agent-chat">
      <div className="chat-main-column">
        <header className="chat-header">
          <div className="chat-header-left">
            <span className="chat-header-avatar">
              <img src={agent.avatar} alt="" />
            </span>
            <div className="chat-header-meta">
              <h2>{agent.displayName}</h2>
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
            {isOmni ? (
              <IconButton
                bare
                size={22}
                icon={Clock}
                label="Scheduled tasks"
                active={schedulesOpen}
                onClick={() => {
                  if (schedulesOpen) {
                    onSchedulesOpenChange?.(false);
                  } else {
                    openSchedulesPanel();
                  }
                }}
              />
            ) : null}
            <IconButton
              bare
              size={22}
              icon={Brain}
              label="Memory"
              active={memoryOpen}
              onClick={() => {
                setPreviewArtifact(null);
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
                setPreviewArtifact(null);
                setMemoryOpen(false);
                setHistoryOpen((open) => !open);
              }}
            />
          </div>
        </header>

        <div className="chat-body" ref={chatBodyRef}>
          <div className="chat-content-column">
            {switchingChatId ? (
              <div className="chat-switching-overlay" role="status" aria-live="polite">
                <Loader2
                  size={24}
                  strokeWidth={2}
                  className="chat-loading-spinner"
                  aria-hidden
                />
                <span>Loading conversation…</span>
              </div>
            ) : null}
            {conversationLoading ? (
              <div className="chat-loading" role="status" aria-live="polite">
                <Loader2
                  size={28}
                  strokeWidth={2}
                  className="chat-loading-spinner"
                  aria-hidden
                />
                <span>Loading conversation…</span>
              </div>
            ) : schedulesOpen && isOmni ? (
              <SchedulePanel
                onOpenResultChat={(chatId) => {
                  onSchedulesOpenChange?.(false);
                  void onOpenChat(chatId);
                }}
              />
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
                  chatId={activeChatId ?? bound.chatId}
                  previewArtifactId={previewArtifact?.artifact_id ?? null}
                  onPreviewArtifact={handlePreviewArtifact}
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

        {schedulesOpen && isOmni ? null : (
          <Composer
            disabled={!token}
            modelLabel={modelLabel}
            busy={isBusy}
            resuming={isResuming}
            cancelling={cancelling}
            chatId={activeChatId}
            eveSessionId={session?.sessionId ?? null}
            agentId={agent.id}
            persistAttachments={Boolean(token)}
            onSend={handleSend}
            onStop={requestCancellation}
          />
        )}
      </div>

      {lastPreviewArtifactRef.current ? (
        <ResizableAside
          defaultWidth={520}
          hidden={!previewArtifact}
        >
          <ArtifactPreviewPanel
            spec={lastPreviewArtifactRef.current}
            apiBase={API_URL}
            token={token}
            chatId={activeChatId ?? bound.chatId}
            open={Boolean(previewArtifact)}
            onClose={() => setPreviewArtifact(null)}
          />
        </ResizableAside>
      ) : null}

      {historyOpen ? (
        <ResizableAside defaultWidth={320}>
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
                      switchingChatId === chat.id || deletingChatId !== null
                    }
                    onClick={() => {
                      if (switchingChatId || deletingChatId) return;
                      void onOpenChat(chat.id);
                    }}
                  >
                    <span className="chat-history-title">
                      {switchingChatId === chat.id ? (
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
        </ResizableAside>
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

      {!previewArtifact && memoryOpen ? (
        <ResizableAside defaultWidth={360}>
          <MemoryPanel
            agentName={agent.displayName}
            memory={memory}
            loading={memoryLoading}
            error={memoryError}
            onClose={() => setMemoryOpen(false)}
          />
        </ResizableAside>
      ) : null}
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
