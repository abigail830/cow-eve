import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ArtifactSpec } from "@fde/artifact-spec";
import { ArtifactPreviewPanel } from "@fde/artifact-ui";
import { collectPendingInputRequests } from "@fde/question-ui";
import {
  supersededToolCallIds,
  useSteerAssistantSplitMap,
} from "../lib/steerMessageLayout";
import { useEveAgent } from "eve/react";
import type { InputResponse, MessageStreamEvent } from "eve/client";
import {
  Brain,
  List,
  Loader2,
  LogOut,
  MessageCirclePlus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  deleteChat,
  fetchChats,
  fetchMemory,
  fetchModelSettings,
  fetchSchedules,
  scheduleTaskLabel,
  type AgentInfo,
  type ChatSummary,
  type ModelSettingsPublic,
  type UserMemorySnapshot,
} from "../lib/api";
import { API_URL, agentHost } from "../lib/config";
import { fetchBoundSession, type BoundSession } from "../lib/load-chat-session";
import { useAuth } from "../lib/auth";
import { isImageMime, type PreparedAttachment } from "../lib/attachments";
import {
  ensureAttachmentsUploaded,
  retryChatAttachmentParse,
  type ChatAttachmentPublic,
} from "../lib/attachmentUpload";
import { useChatAudioCaptures } from "../hooks/useChatAudioCaptures";
import {
  retryAudioCaptureTranscription,
  type AudioCapturePublic,
} from "../lib/audioCapture";
import { mergeStreamEventsForTimeline } from "../lib/platformProductTurns";
import {
  buildMessageContent,
  mergeAttachmentIdsForSend,
  mergeClientContextIntoMessage,
} from "../lib/attachmentSend";
import {
  hintsFromPrepared,
  messageMatchesSendHint,
  type PendingSendAttachmentHint,
  type UserMessageAttachmentHint,
} from "../lib/sentMessageAttachments";
import {
  collapseUserClientContextMessages,
  userVisibleTextFromParts,
  workspaceFileIdsFromMessageParts,
} from "../lib/userMessageAttachments";
import { registerChatWorkspaceFileRefs } from "../lib/chatWorkspaceRefs";
import {
  lookupWorkspaceFiles,
  type WorkspaceFilePublic,
} from "../lib/workspace";
import { AttachmentParseDrawer } from "./AttachmentParseDrawer";
import { Composer, type ComposerSendPayload } from "./Composer";
import { IconButton } from "./IconButton";
import { MemoryPanel } from "./MemoryPanel";
import { MessageStream } from "./MessageStream";
import { ResizableAside } from "./ResizableAside";
import { useBindChatSession } from "../hooks/useBindChatSession";
import { fetchProject, type ProjectPublic } from "../lib/projects";
import { ProjectListPanel } from "./ProjectListPanel";
import { ProjectEditor } from "./ProjectEditor";
import { WorkHubCards } from "./WorkHubCards";
import "./AgentAsidePanel.css";
import "./AgentChat.css";
import "./ProjectListPanel.css";
import "./ProjectEditor.css";
import "./WorkHubCards.css";

type Props = {
  agent: AgentInfo;
  /** When re-selecting this agent, reopen this chat (parent remembers per agent). */
  restoreChatId?: string | null;
  /** Open Customize → Schedules. */
  onOpenSchedules?: () => void;
  /** Open Customize → Projects. */
  onOpenProjects?: () => void;
  /** Set when opening a scheduled-task result chat. */
  scheduleView?: { id: string; label: string } | null;
  onScheduleViewChange?: (
    next: { id: string; label: string } | null,
  ) => void;
  /** When set, new sessions bind to this project and history is scoped. */
  projectId?: string | null;
  onProjectIdChange?: (projectId: string | null) => void;
  onActiveChatChange?: (chatId: string | null) => void;
  onStreamingChange?: (streaming: boolean) => void;
};

function AgentChatLoading(_: { agent: AgentInfo }) {
  return (
    <div className="agent-chat">
      <div className="chat-main-column">
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
  onOpenSchedules,
  onOpenProjects,
  scheduleView = null,
  onScheduleViewChange,
  projectId = null,
  onProjectIdChange,
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
    source: "generic",
    projectId: null,
    scheduledTaskId: null,
  }));

  const chatListOptions = useMemo(() => {
    if (projectId) return { scope: "project" as const, projectId };
    const scheduleId =
      scheduleView?.id ||
      (bound.source === "schedule" ? bound.scheduledTaskId : null);
    if (scheduleId) {
      return { scope: "schedule" as const, scheduleId };
    }
    return { scope: "generic" as const };
  }, [bound.scheduledTaskId, bound.source, projectId, scheduleView?.id]);

  const refreshChats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchChats(agent.id, chatListOptions);
      setChats(res.chats);
      setHistoryError(null);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "Failed to load history",
      );
    }
  }, [agent.id, token, chatListOptions]);

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
        source: "generic",
        projectId: null,
        scheduledTaskId: null,
      });
    }

    void (async () => {
      if (!token) return;

      let ignorePrefetchedChats = false;
      const chatsTask = fetchChats(agent.id, chatListOptions)
        .then((res) => {
          if (cancelled || ignorePrefetchedChats) return res;
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
          if (next.source === "schedule" && next.scheduledTaskId) {
            ignorePrefetchedChats = true;
          }
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

  useEffect(() => {
    if (!token) return;
    void refreshChats();
  }, [projectId, token, refreshChats]);

  const startNewChat = () => {
    onScheduleViewChange?.(null);
    syncActiveChat(null);
    setBound({
      chatId: null,
      session: undefined,
      events: undefined,
      resume: false,
      key: `new-${agent.id}-${Date.now()}`,
      source: "generic",
      projectId: null,
      scheduledTaskId: null,
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
      onOpenSchedules={onOpenSchedules}
      onOpenProjects={onOpenProjects}
      scheduleView={scheduleView}
      onScheduleViewChange={onScheduleViewChange}
      projectId={projectId}
      onProjectIdChange={onProjectIdChange}
      onReloadConversation={(chatId) => void bindChat(chatId)}
      onCaptureChatLinked={(chatId) => {
        syncActiveChat(chatId);
        setBound((prev) =>
          prev.chatId === chatId ? prev : { ...prev, chatId, key: prev.key },
        );
        void refreshChats();
      }}
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
  onOpenSchedules?: () => void;
  onOpenProjects?: () => void;
  scheduleView: { id: string; label: string } | null;
  onScheduleViewChange?: (
    next: { id: string; label: string } | null,
  ) => void;
  projectId: string | null;
  onProjectIdChange?: (projectId: string | null) => void;
  onReloadConversation?: (chatId: string) => void;
  onCaptureChatLinked?: (chatId: string) => void;
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
  onOpenSchedules,
  onOpenProjects,
  scheduleView,
  onScheduleViewChange,
  projectId,
  onProjectIdChange,
  onReloadConversation,
  onCaptureChatLinked,
}: SessionProps) {
  const [projectsOpen, setProjectsOpen] = useState(false);
  const navigate = useNavigate();
  const [projectDetail, setProjectDetail] = useState<ProjectPublic | null>(null);
  const [scheduleLabel, setScheduleLabel] = useState<string | null>(null);
  const scheduleChatId =
    !projectId && (scheduleView?.id ||
      (bound.source === "schedule" ? bound.scheduledTaskId : null));
  const scheduleTitle =
    scheduleView?.label || scheduleLabel;
  const [previewArtifact, setPreviewArtifact] = useState<ArtifactSpec | null>(null);
  const [parseDrawerAttachment, setParseDrawerAttachment] =
    useState<ChatAttachmentPublic | null>(null);
  const [audioCaptureRefreshKey, setAudioCaptureRefreshKey] = useState(0);
  const [optimisticCaptures, setOptimisticCaptures] = useState<
    AudioCapturePublic[]
  >([]);
  const lastPreviewArtifactRef = useRef<ArtifactSpec | null>(null);
  if (previewArtifact) lastPreviewArtifactRef.current = previewArtifact;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memory, setMemory] = useState<UserMemorySnapshot | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [cancellationError, setCancellationError] = useState<string>();
  const [sendError, setSendError] = useState<string>();
  const [userMessageAttachmentHints, setUserMessageAttachmentHints] = useState<
    ReadonlyMap<string, readonly UserMessageAttachmentHint[]>
  >(() => new Map());
  const pendingSendAttachmentHintsRef = useRef<PendingSendAttachmentHint[]>([]);
  const [optimisticWorkspaceFiles, setOptimisticWorkspaceFiles] = useState<
    ReadonlyMap<string, WorkspaceFilePublic>
  >(() => new Map());
  /** True after cancel() is accepted until the stream settles. */
  const [cancelling, setCancelling] = useState(false);
  /** Set when stop was requested but the turn is still busy after a long wait. */
  const [stopSlowWarning, setStopSlowWarning] = useState(false);
  /** Stop reconnecting a persisted stream that never reaches session idle. */
  const [resumeAbandoned, setResumeAbandoned] = useState(false);
  const [stuckTurnNotice, setStuckTurnNotice] = useState(false);
  const [hitlResponding, setHitlResponding] = useState(false);
  const [pendingDeleteChat, setPendingDeleteChat] = useState<ChatSummary | null>(
    null,
  );
  // eve fires onSessionChange for every stream event; only refresh when the
  // durable session id actually changes (new chat), plus once on turn finish.
  const knownSessionIdRef = useRef(bound.session?.sessionId);
  const [knownEveSessionId, setKnownEveSessionId] = useState<string | null>(
    bound.session?.sessionId ?? null,
  );
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const stickChatToBottomRef = useRef(true);
  const onStreamingChangeRef = useRef(onStreamingChange);
  onStreamingChangeRef.current = onStreamingChange;

  const host = agentHost(agent.id);
  const shouldResumeStream = bound.resume && !resumeAbandoned;

  const dismissStuckStream = useCallback(() => {
    setResumeAbandoned(true);
    setStuckTurnNotice(false);
    setBound((current) => ({
      ...current,
      resume: false,
      key: `${current.key}-idle`,
    }));
  }, []);

  const { data, status, error, events, session, send, cancel, respond } =
    useEveAgent({
      host,
      auth: token ? { bearer: () => token } : undefined,
      initialSession: bound.session,
      initialEvents: bound.events,
      resume: shouldResumeStream,
      onSessionChange: (session) => {
        const nextId = session?.sessionId;
        if (!nextId || nextId === knownSessionIdRef.current) return;
        knownSessionIdRef.current = nextId;
        setKnownEveSessionId(nextId);
        onRefreshChats();
      },
      onFinish: () => {
        onRefreshChats();
      },
    });

  const sessionWorkspaceFileIds = useMemo(() => {
    const display = collapseUserClientContextMessages(data.messages);
    const ids = new Set<string>();
    for (const row of display) {
      for (const id of workspaceFileIdsFromMessageParts(row.message.parts)) {
        ids.add(id);
      }
      for (const id of row.extraWorkspaceFileIds) {
        ids.add(id);
      }
    }
    return [...ids].sort();
  }, [data.messages]);

  const sessionWorkspaceIdsKey = sessionWorkspaceFileIds.join("\0");

  const [sessionWorkspaceFiles, setSessionWorkspaceFiles] = useState<
    WorkspaceFilePublic[]
  >([]);

  const sessionWorkspaceFilesById = useMemo(() => {
    const map = new Map<string, WorkspaceFilePublic>();
    for (const file of sessionWorkspaceFiles) map.set(file.id, file);
    return map;
  }, [sessionWorkspaceFiles]);

  const workspaceFilesById = useMemo(() => {
    const map = new Map<string, WorkspaceFilePublic>(optimisticWorkspaceFiles);
    for (const [id, file] of sessionWorkspaceFilesById) map.set(id, file);
    return map;
  }, [optimisticWorkspaceFiles, sessionWorkspaceFilesById]);

  useEffect(() => {
    if (sessionWorkspaceFileIds.length === 0) {
      setSessionWorkspaceFiles([]);
      return;
    }
    let cancelled = false;
    void lookupWorkspaceFiles(sessionWorkspaceFileIds)
      .then((files) => {
        if (!cancelled) setSessionWorkspaceFiles(files);
      })
      .catch(() => {
        if (!cancelled) setSessionWorkspaceFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionWorkspaceIdsKey]);

  // Eve status contract (0.70+): approvals/questions hold the turn open — the store
  // stays `streaming` while `turn.waiting`; `respond()` is valid during that window.
  // - submitted | streaming → active turn: Stop calls cancel(); draft send uses steer
  // - resuming → catch-up only: no Stop, no send
  const isBusy = status === "submitted" || status === "streaming";
  const isResuming = status === "resuming";
  const steerSplits = useSteerAssistantSplitMap(data.messages);
  const pendingHitl = useMemo(() => {
    const superseded = supersededToolCallIds(data.messages, steerSplits);
    return collectPendingInputRequests(data.messages).filter(
      (item) => !superseded.has(item.toolCallId),
    );
  }, [data.messages, steerSplits]);
  const hitlAwaitingAnswer =
    pendingHitl.length > 0 && !isResuming && !hitlResponding;

  const handleHitlRespond = useCallback(
    async (responses: InputResponse[]) => {
      if (isResuming || hitlResponding) return;
      setHitlResponding(true);
      try {
        await respond(responses);
      } finally {
        setHitlResponding(false);
      }
    },
    [respond, isResuming, hitlResponding],
  );
  const conversationLoading =
    bound.resume &&
    (bound.events?.length ?? 0) === 0 &&
    data.messages.length === 0 &&
    (isResuming || status === "ready");
  const turnFailure =
    isBusy || isResuming ? undefined : latestTurnFailure(events);
  const errorMessage =
    cancellationError ?? sendError ?? error?.message ?? turnFailure;

  useEffect(() => {
    if (!isBusy) {
      setCancelling(false);
      setStopSlowWarning(false);
    }
  }, [isBusy]);

  useEffect(() => {
    if (!cancelling || !isBusy) return;
    const timer = window.setTimeout(() => setStopSlowWarning(true), 45_000);
    return () => window.clearTimeout(timer);
  }, [cancelling, isBusy]);

  // Reset attachment UI hints only when switching conversations (new chat / open history),
  // not when Eve assigns sessionId or the platform chat row appears mid-turn.
  useEffect(() => {
    setUserMessageAttachmentHints(new Map());
    pendingSendAttachmentHintsRef.current = [];
    setOptimisticWorkspaceFiles(new Map());
  }, [bound.key]);

  useEffect(() => {
    setResumeAbandoned(false);
    setStuckTurnNotice(false);
  }, [bound.chatId, agent.id]);

  const streamProgressRef = useRef({
    eventCount: 0,
    status: "ready" as string,
  });
  streamProgressRef.current = { eventCount: events.length, status };

  useEffect(() => {
    if (!shouldResumeStream || !activeChatId) return;
    const baseline = bound.events?.length ?? 0;
    const timer = window.setTimeout(() => {
      const { eventCount, status: liveStatus } = streamProgressRef.current;
      const stillBusy =
        liveStatus === "streaming" ||
        liveStatus === "resuming" ||
        liveStatus === "submitted";
      if (stillBusy && eventCount <= baseline) {
        dismissStuckStream();
        setStuckTurnNotice(true);
      }
    }, 90_000);
    return () => window.clearTimeout(timer);
  }, [
    activeChatId,
    bound.events?.length,
    dismissStuckStream,
    shouldResumeStream,
  ]);

  const prevProjectIdRef = useRef(projectId);
  useEffect(() => {
    const prev = prevProjectIdRef.current;
    prevProjectIdRef.current = projectId;
    if (prev !== projectId && prev != null && projectId != null) {
      onNewChat();
    }
  }, [projectId, onNewChat]);

  useEffect(() => {
    if (!projectId) {
      setProjectDetail(null);
      return;
    }
    let cancelled = false;
    void fetchProject(projectId, agent.id)
      .then((project) => {
        if (!cancelled) setProjectDetail(project);
      })
      .catch(() => {
        if (!cancelled) setProjectDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, agent.id]);

  useEffect(() => {
    setProjectSettingsOpen(false);
  }, [projectId]);

  useEffect(() => {
    if (!scheduleChatId) {
      setScheduleLabel(null);
      return;
    }
    let cancelled = false;
    void fetchSchedules(agent.id)
      .then((res) => {
        if (cancelled) return;
        const task = res.schedules.find((item) => item.id === scheduleChatId);
        const name = task?.name?.trim();
        const prompt = task?.prompt?.trim();
        setScheduleLabel(
          name ||
            (prompt
              ? prompt.length > 42
                ? `${prompt.slice(0, 42)}…`
                : prompt
              : null),
        );
      })
      .catch(() => {
        if (!cancelled) setScheduleLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [agent.id, scheduleChatId]);

  useEffect(() => {
    const fromBound = bound.session?.sessionId?.trim();
    if (fromBound) {
      knownSessionIdRef.current = fromBound;
      setKnownEveSessionId(fromBound);
    }
  }, [bound.session?.sessionId, bound.key]);

  const uploadEveSessionId = useMemo(
    () => resolveUploadEveSessionId(session, events, knownEveSessionId),
    [events, knownEveSessionId, session],
  );

  useBindChatSession({
    token,
    agentId: agent.id,
    projectId,
    eveSessionId: uploadEveSessionId,
    conversationKey: bound.key,
  });

  const workSurfaceOpen = projectsOpen;

  const enterProject = useCallback(
    (id: string) => {
      onProjectIdChange?.(id);
      setProjectsOpen(false);
      setPreviewArtifact(null);
      setHistoryOpen(false);
      setProjectSettingsOpen(false);
      setMemoryOpen(false);
      onNewChat();
    },
    [onNewChat, onProjectIdChange],
  );

  const exitProject = useCallback(() => {
    onProjectIdChange?.(null);
    onNewChat();
  }, [onNewChat, onProjectIdChange]);

  const audioCaptureTarget = useMemo(
    () => ({
      chatId: activeChatId ?? bound.chatId,
      eveSessionId: uploadEveSessionId,
      agentId: agent.id,
    }),
    [activeChatId, agent.id, bound.chatId, uploadEveSessionId],
  );

  const { submittedCaptures, retryCapture } = useChatAudioCaptures({
    target: audioCaptureTarget,
    enabled: Boolean(token),
    refreshKey: audioCaptureRefreshKey,
  });

  useEffect(() => {
    if (optimisticCaptures.length === 0) return;
    const submittedIds = new Set(submittedCaptures.map((c) => c.id));
    setOptimisticCaptures((prev) =>
      prev.filter((c) => !submittedIds.has(c.id)),
    );
  }, [submittedCaptures, optimisticCaptures.length]);

  const streamCaptures = useMemo(() => {
    const byId = new Map<string, AudioCapturePublic>();
    for (const c of submittedCaptures) byId.set(c.id, c);
    for (const c of optimisticCaptures) byId.set(c.id, c);
    return [...byId.values()].sort(
      (a, b) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    );
  }, [optimisticCaptures, submittedCaptures]);

  const timelineEvents = useMemo((): readonly MessageStreamEvent[] => {
    const live = events ?? [];
    const persisted = bound.events ?? [];
    return mergeStreamEventsForTimeline(live, persisted);
  }, [bound.events, events]);

  const handleRetryParseDrawer = useCallback(
    async (attachment: ChatAttachmentPublic) => {
      const cid = activeChatId ?? bound.chatId ?? attachment.chatId;
      if (!cid) return;
      if (attachment.parsePipelineId === "audio_transcription_standard") {
        const capture = submittedCaptures.find(
          (c) => c.outputAttachmentId === attachment.id,
        );
        if (capture) {
          const updatedCapture = await retryAudioCaptureTranscription(
            cid,
            capture.id,
          );
          if (updatedCapture.outputAttachment) {
            setParseDrawerAttachment(updatedCapture.outputAttachment);
          }
          setAudioCaptureRefreshKey((k) => k + 1);
          return;
        }
      }
      const updated = await retryChatAttachmentParse(cid, attachment.id);
      setParseDrawerAttachment(updated);
      setAudioCaptureRefreshKey((k) => k + 1);
    },
    [activeChatId, bound.chatId, submittedCaptures],
  );

  useEffect(() => {
    const pending = pendingSendAttachmentHintsRef.current;
    if (pending.length === 0) return;

    setUserMessageAttachmentHints((prev) => {
      let next: Map<string, readonly UserMessageAttachmentHint[]> | null = null;
      const queue = [...pending];

      for (const msg of data.messages) {
        if (msg.role !== "user") continue;
        if (prev.has(msg.id)) continue;

        const visibleText = userVisibleTextFromParts(msg.parts);
        const matchIndex = queue.findIndex((hint) =>
          messageMatchesSendHint(visibleText, hint),
        );
        if (matchIndex < 0) continue;

        const [matched] = queue.splice(matchIndex, 1);
        if (!next) next = new Map(prev);
        next.set(msg.id, matched.items);
      }

      if (queue.length > 0) {
        for (let i = data.messages.length - 1; i >= 0; i -= 1) {
          const msg = data.messages[i];
          if (msg.role !== "user") continue;
          const map = next ?? prev;
          if (map.has(msg.id)) continue;
          const [matched] = queue.splice(0, 1);
          if (!next) next = new Map(prev);
          next.set(msg.id, matched.items);
          break;
        }
      }

      pendingSendAttachmentHintsRef.current = queue;
      return next ?? prev;
    });
  }, [data.messages]);

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = chatBodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const body = chatBodyRef.current;
    if (!body) return;
    const onScroll = () => {
      const distanceFromBottom =
        body.scrollHeight - body.scrollTop - body.clientHeight;
      stickChatToBottomRef.current = distanceFromBottom < 96;
    };
    body.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => body.removeEventListener("scroll", onScroll);
  }, [bound.chatId]);

  // Land at latest messages when switching chats; follow growth while pinned.
  useLayoutEffect(() => {
    if (conversationLoading) return;
    stickChatToBottomRef.current = true;
    scrollChatToBottom();
    requestAnimationFrame(() => scrollChatToBottom());
  }, [conversationLoading, bound.chatId, scrollChatToBottom]);

  useLayoutEffect(() => {
    if (conversationLoading || !stickChatToBottomRef.current) return;
    scrollChatToBottom();
    requestAnimationFrame(() => scrollChatToBottom());
  }, [
    conversationLoading,
    data.messages,
    events,
    isBusy,
    scrollChatToBottom,
  ]);

  useEffect(() => {
    const body = chatBodyRef.current;
    const content = chatContentRef.current;
    if (!body || !content || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (!stickChatToBottomRef.current) return;
      scrollChatToBottom();
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [bound.chatId, scrollChatToBottom]);

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
    if (!isBusy) return;
    setCancellationError(undefined);
    setSendError(undefined);
    setCancelling(true);
    setStopSlowWarning(false);
    // cancel() may return before in-flight tools finish; settlement is on the stream.
    // Allow repeated Stop clicks to retry the cancel request.
    void cancel().catch((err: unknown) => {
      setCancelling(false);
      setCancellationError(
        err instanceof Error ? err.message : "Unable to cancel the response.",
      );
    });
  }, [cancel, isBusy]);

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

      const missingPlatform = attachments.filter(
        (item) => !isImageMime(item.mediaType) && !item.platformId,
      );
      if (missingPlatform.length > 0) {
        setSendError(
          "Could not upload attachments to this chat. Wait for the session to connect and try again.",
        );
        return;
      }

      const message =
        attachments.length > 0
          ? buildMessageContent(trimmed, attachments)
          : trimmed;

      const attachmentIds = mergeAttachmentIdsForSend(
        attachments
          .map((item) => item.platformId)
          .filter((id): id is string => Boolean(id)),
        payload.attachmentIds ?? [],
      );
      const workspaceFileIds = payload.workspaceFileIds ?? [];
      const clientContextPayload = {
        ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
        ...(workspaceFileIds.length > 0 ? { workspaceFileIds } : {}),
      };
      const messageForSend =
        attachmentIds.length > 0 || workspaceFileIds.length > 0
          ? mergeClientContextIntoMessage(message, clientContextPayload)
          : message;
      const sendOptions = {
        ...(isBusy ? { turnPolicy: "steer" as const } : {}),
        ...(attachmentIds.length > 0 || workspaceFileIds.length > 0
          ? { clientContext: clientContextPayload }
          : {}),
      };
      const libraryBackup =
        token && payload.attachments.some((item) => !item.platformId)
          ? payload.attachments
          : null;

      const sendHints = hintsFromPrepared(attachments, attachmentIds);
      if (sendHints.length > 0) {
        pendingSendAttachmentHintsRef.current.push({
          text: trimmed,
          items: sendHints,
        });
      }

      const workspaceFiles = payload.workspaceFiles ?? [];
      if (workspaceFiles.length > 0) {
        setOptimisticWorkspaceFiles((prev) => {
          const next = new Map(prev);
          for (const file of workspaceFiles) next.set(file.id, file);
          return next;
        });
      }

      const chatIdForRefs = activeChatId ?? bound.chatId;
      if (token && chatIdForRefs && workspaceFileIds.length > 0) {
        try {
          await registerChatWorkspaceFileRefs(chatIdForRefs, workspaceFileIds);
        } catch (err) {
          setSendError(
            err instanceof Error
              ? err.message
              : "Could not link workspace files to this chat.",
          );
          return;
        }
      }

      // While a turn is active, steer at the next boundary instead of opening
      // a second turn (eve rejects plain send with "already processing").
      void send(
        messageForSend,
        Object.keys(sendOptions).length > 0 ? sendOptions : undefined,
      )
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
      bound.chatId,
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
    setProjectSettingsOpen(false);
    setMemoryOpen(false);
    setPreviewArtifact(spec);
  }, []);

  function closePanels() {
    setHistoryOpen(false);
    setProjectSettingsOpen(false);
    setMemoryOpen(false);
    setPreviewArtifact(null);
    setProjectsOpen(false);
  }

  const refreshProjectDetail = useCallback(() => {
    if (!projectId) return;
    void fetchProject(projectId, agent.id)
      .then(setProjectDetail)
      .catch(() => undefined);
  }, [projectId, agent.id]);

  const streamEmptyState = useMemo(() => {
    if (workSurfaceOpen || conversationLoading || isBusy) return undefined;
    if (projectId) {
      return (
        <p className="chat-project-empty-hint">
          {projectDetail
            ? `Project: ${projectDetail.name}. Send a message to start.`
            : "Send a message to start this project chat."}
        </p>
      );
    }
    return (
      <WorkHubCards
        agentId={agent.id}
        onOpenSchedules={() => onOpenSchedules?.()}
        onOpenProjects={() => {
          if (onOpenProjects) {
            onOpenProjects();
            return;
          }
          setProjectsOpen(true);
        }}
        onOpenChat={(chatId) => {
          void onOpenChat(chatId);
        }}
        onOpenScheduleResult={(task) => {
          onScheduleViewChange?.({
            id: task.id,
            label: scheduleTaskLabel(task),
          });
          if (task.lastChatId) {
            void onOpenChat(task.lastChatId);
            return;
          }
          void fetchChats(agent.id, {
            scope: "schedule",
            scheduleId: task.id,
          }).then((res) => {
            const latest = res.chats[0];
            if (latest) void onOpenChat(latest.id);
          });
        }}
        onEnterProject={enterProject}
      />
    );
  }, [
    agent.id,
    conversationLoading,
    enterProject,
    isBusy,
    onOpenSchedules,
    onOpenProjects,
    onOpenChat,
    onScheduleViewChange,
    projectDetail,
    projectId,
    workSurfaceOpen,
  ]);

  return (
    <div className="agent-chat">
      <div className="chat-main-column">
        <header className="chat-header chat-header--toolbar">
          <div className="chat-header-leading">
            {projectsOpen ? (
              <h2 className="page-title work-page-title">
                <span>Work</span>
                <span className="work-page-title-sep" aria-hidden>
                  |
                </span>
                <span>Projects</span>
              </h2>
            ) : projectId ? (
              <h2 className="page-title work-page-title">
                <span>Work</span>
                <span className="work-page-title-sep" aria-hidden>
                  |
                </span>
                <span>
                  {projectDetail ? `Project - ${projectDetail.name}` : "Project"}
                </span>
              </h2>
            ) : scheduleChatId ? (
              <h2 className="page-title work-page-title">
                <span>Work</span>
                <span className="work-page-title-sep" aria-hidden>
                  |
                </span>
                <span>
                  {scheduleTitle ? `Schedule - ${scheduleTitle}` : "Schedule"}
                </span>
              </h2>
            ) : (
              <h2 className="page-title work-page-title">Work</h2>
            )}
            {projectId ? (
              <IconButton
                bare
                size={22}
                icon={LogOut}
                label="Exit project"
                onClick={() => {
                  closePanels();
                  exitProject();
                }}
              />
            ) : scheduleChatId ? (
              <IconButton
                bare
                size={22}
                icon={LogOut}
                label="Back to Work"
                onClick={() => {
                  closePanels();
                  onNewChat();
                }}
              />
            ) : null}
          </div>
          <div className="chat-header-actions">
            {projectId ? (
              <>
                <IconButton
                  bare
                  size={22}
                  icon={Pencil}
                  label="Project settings"
                  active={projectSettingsOpen}
                  onClick={() => {
                    setPreviewArtifact(null);
                    setHistoryOpen(false);
                    setMemoryOpen(false);
                    setProjectSettingsOpen((open) => !open);
                  }}
                />
                <span className="chat-header-actions-sep" aria-hidden />
              </>
            ) : null}
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
                setPreviewArtifact(null);
                setHistoryOpen(false);
                setProjectSettingsOpen(false);
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
                setProjectSettingsOpen(false);
                setHistoryOpen((open) => !open);
              }}
            />
          </div>
        </header>

        <div className="chat-body" ref={chatBodyRef}>
          <div className="chat-content-column" ref={chatContentRef}>
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
            ) : projectsOpen ? (
              <ProjectListPanel
                agentId={agent.id}
                onEnterProject={enterProject}
                onEditProject={(id) =>
                  navigate(`/agents/${agent.id}/projects/${id}/edit`, {
                    state: { returnTo: `/agents/${agent.id}` },
                  })
                }
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
                  events={timelineEvents}
                  streaming={isBusy}
                  resuming={isResuming}
                  apiBase={API_URL}
                  token={token}
                  chatId={activeChatId ?? bound.chatId}
                  eveSessionId={uploadEveSessionId}
                  userMessageAttachmentHints={userMessageAttachmentHints}
                  previewArtifactId={previewArtifact?.artifact_id ?? null}
                  onPreviewArtifact={handlePreviewArtifact}
                  audioCaptures={streamCaptures}
                  onRetryAudioCapture={(cid, captureId) =>
                    retryCapture(cid, captureId)
                  }
                  onOpenAttachmentPipeline={setParseDrawerAttachment}
                  workspaceFilesById={workspaceFilesById}
                  emptyState={streamEmptyState}
                  onHitlRespond={handleHitlRespond}
                  hitlResponding={hitlResponding}
                />
                {cancelling && isBusy ? (
                  <p className="chat-status" role="status">
                    {stopSlowWarning
                      ? "Stop is taking longer than usual. Searches or MCP calls may still be running—click Stop again or refresh this chat to reconnect."
                      : "Stopping… waiting for the current step to finish."}
                  </p>
                ) : null}
                {stuckTurnNotice ? (
                  <p className="chat-status" role="status">
                    This turn stopped making progress (often after a deploy or
                    restart). Tools marked Interrupted did not finish. Send a new
                    message here or start a new chat.
                  </p>
                ) : null}
                {shouldResumeStream && isBusy ? (
                  <p className="chat-status">
                    <button
                      type="button"
                      className="chat-status-dismiss"
                      onClick={() => dismissStuckStream()}
                    >
                      Stop reconnecting this turn
                    </button>
                  </p>
                ) : null}
                {errorMessage ? (
                  <p className="chat-error">{errorMessage}</p>
                ) : null}
              </>
            )}
          </div>
        </div>

        {workSurfaceOpen ? null : (
          <Composer
            disabled={!token}
            modelLabel={modelLabel}
            busy={isBusy}
            resuming={isResuming}
            cancelling={cancelling}
            hitlAwaitingAnswer={hitlAwaitingAnswer}
            chatId={activeChatId ?? bound.chatId}
            eveSessionId={uploadEveSessionId}
            agentId={agent.id}
            persistAttachments={Boolean(token)}
            parseDrawerAttachment={parseDrawerAttachment}
            onParseDrawerAttachmentChange={setParseDrawerAttachment}
            onCaptureChatLinked={onCaptureChatLinked}
            onCaptureStarted={(capture) => {
              setOptimisticCaptures((prev) => [
                ...prev.filter((c) => c.id !== capture.id),
                capture,
              ]);
              setAudioCaptureRefreshKey((k) => k + 1);
              onReloadConversation?.(capture.chatId);
            }}
            onAudioCaptureActivity={() => {
              setAudioCaptureRefreshKey((k) => k + 1);
            }}
            sessionWorkspaceFiles={sessionWorkspaceFiles}
            projectId={projectId}
            onSend={handleSend}
            onStop={requestCancellation}
          />
        )}
      </div>

      <AttachmentParseDrawer
        attachment={parseDrawerAttachment}
        onClose={() => setParseDrawerAttachment(null)}
        onRetry={
          activeChatId ?? bound.chatId ? handleRetryParseDrawer : undefined
        }
      />

      {lastPreviewArtifactRef.current ? (
        <ResizableAside
          defaultWidth={520}
          hidden={!previewArtifact}
          showHandleDivider={false}
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

      {projectId && projectSettingsOpen ? (
        <ResizableAside defaultWidth={480} minWidth={360} showHandleDivider={false}>
          <aside className="agent-aside-panel project-settings-panel">
            <div className="agent-aside-panel-header">
              <div className="agent-aside-panel-title">
                <h3>Project settings</h3>
              </div>
              <button
                type="button"
                className="agent-aside-panel-close"
                aria-label="Close project settings"
                onClick={() => setProjectSettingsOpen(false)}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="agent-aside-panel-body project-settings-panel-body">
              <ProjectEditor
                variant="panel"
                projectId={projectId}
                agentId={agent.id}
                onProjectUpdated={refreshProjectDetail}
              />
            </div>
          </aside>
        </ResizableAside>
      ) : null}

      {historyOpen ? (
        <ResizableAside defaultWidth={320} showHandleDivider={false}>
        <aside className="agent-aside-panel chat-history-panel">
          <div className="agent-aside-panel-header">
            <div className="agent-aside-panel-title">
              <h3>Chat history ({chats.length})</h3>
            </div>
            <button
              type="button"
              className="agent-aside-panel-close"
              aria-label="Close chat history"
              onClick={() => setHistoryOpen(false)}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="agent-aside-panel-body chat-history-panel-body">
            {historyError ? (
              <p className="chat-history-error">{historyError}</p>
            ) : null}
            {projectId ? (
              <p className="chat-history-empty">Chats in this project.</p>
            ) : scheduleChatId ? (
              <p className="chat-history-empty">
                Chats from this scheduled task.
              </p>
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
        <ResizableAside defaultWidth={360} showHandleDivider={false}>
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

function resolveUploadEveSessionId(
  session: { sessionId?: string } | undefined,
  events: readonly MessageStreamEvent[],
  knownId: string | null,
): string | null {
  const fromSession = session?.sessionId?.trim();
  if (fromSession) return fromSession;
  const fromKnown = knownId?.trim();
  if (fromKnown) return fromKnown;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index] as {
      sessionId?: string;
      data?: { sessionId?: string };
    };
    const fromEvent = event.sessionId ?? event.data?.sessionId;
    if (typeof fromEvent === "string" && fromEvent.trim()) {
      return fromEvent.trim();
    }
  }
  return null;
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
      event?.type === "turn.waiting" ||
      event?.type === "message.received"
    ) {
      return undefined;
    }
  }
  return undefined;
}
