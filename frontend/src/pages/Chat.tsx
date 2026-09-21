import { memo, useCallback, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { fetchAgents, type AgentInfo } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AgentChat } from "../components/AgentChat";
import { AppHeader } from "../components/AppHeader";
import { Sidebar } from "../components/Sidebar";
import "./Chat.css";

const AgentChatPane = memo(function AgentChatPane({
  agent,
  hidden,
  restoreChatId,
  schedulesOpen,
  onSchedulesOpenChange,
  onRememberChat,
  onStreamingChange,
}: {
  agent: AgentInfo;
  hidden: boolean;
  restoreChatId: string | null;
  schedulesOpen?: boolean;
  onSchedulesOpenChange?: (open: boolean) => void;
  onRememberChat: (agentId: string, chatId: string | null) => void;
  onStreamingChange: (agentId: string | null) => void;
}) {
  const handleActiveChatChange = useCallback(
    (chatId: string | null) => onRememberChat(agent.id, chatId),
    [agent.id, onRememberChat],
  );
  const handleStreamingChange = useCallback(
    (streaming: boolean) =>
      onStreamingChange(streaming ? agent.id : null),
    [agent.id, onStreamingChange],
  );

  return (
    <div
      className="chat-agent-pane"
      hidden={hidden}
      aria-hidden={hidden}
    >
      <AgentChat
        agent={agent}
        restoreChatId={restoreChatId}
        schedulesOpen={schedulesOpen}
        onSchedulesOpenChange={onSchedulesOpenChange}
        onActiveChatChange={handleActiveChatChange}
        onStreamingChange={handleStreamingChange}
      />
    </div>
  );
});

export function ChatPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("omni");
  /** Keep mounted after first visit so agent switches do not remount and re-fetch. */
  const [visitedAgentIds, setVisitedAgentIds] = useState<string[]>(() => [
    "omni",
  ]);
  const [streamingAgentId, setStreamingAgentId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Last opened chat per agent; survives agent switches (AgentChat unmounts). */
  const [lastChatByAgent, setLastChatByAgent] = useState<
    Record<string, string>
  >({});
  const [omniSchedulesOpen, setOmniSchedulesOpen] = useState(false);

  const rememberAgentChat = useCallback(
    (agentId: string, chatId: string | null) => {
      setLastChatByAgent((prev) => {
        if (chatId === null) {
          if (!(agentId in prev)) return prev;
          const next = { ...prev };
          delete next[agentId];
          return next;
        }
        if (prev[agentId] === chatId) return prev;
        return { ...prev, [agentId]: chatId };
      });
    },
    [],
  );

  const selectAgent = useCallback((agentId: string) => {
    setSelectedId(agentId);
    if (agentId !== "omni") {
      setOmniSchedulesOpen(false);
    }
    setVisitedAgentIds((prev) =>
      prev.includes(agentId) ? prev : [...prev, agentId],
    );
  }, []);

  useEffect(() => {
    const state = location.state as
      | {
          restoreAgentId?: string;
          restoreChatId?: string;
          openSchedules?: boolean;
        }
      | null
      | undefined;
    if (!state) return;

    if (state.openSchedules) {
      setSelectedId("omni");
      setVisitedAgentIds((prev) =>
        prev.includes("omni") ? prev : [...prev, "omni"],
      );
      setOmniSchedulesOpen(true);
    }

    if (state.restoreAgentId && state.restoreChatId) {
      setSelectedId(state.restoreAgentId);
      setVisitedAgentIds((prev) =>
        prev.includes(state.restoreAgentId!)
          ? prev
          : [...prev, state.restoreAgentId!],
      );
      setLastChatByAgent((prev) => ({
        ...prev,
        [state.restoreAgentId!]: state.restoreChatId!,
      }));
    }

    if (state.openSchedules || (state.restoreAgentId && state.restoreChatId)) {
      navigate(".", { replace: true, state: null });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchAgents()
      .then((res) => {
        if (cancelled) return;
        setAgents(res.agents);
        if (res.agents.length > 0) {
          setSelectedId((prev) =>
            res.agents.some((a) => a.id === prev) ? prev : res.agents[0].id,
          );
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load agents",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token || !user) return <Navigate to="/login" replace />;

  const selected = agents.find((a) => a.id === selectedId) ?? agents[0];

  return (
    <div className="app-shell">
      <AppHeader
        activeModule="agent-team"
        userName={user.displayName}
        userEmail={user.email}
        onOpenSettings={() => navigate("/settings")}
        onLogout={logout}
      />
      <div className="app-body">
        <Sidebar
          agents={agents}
          selectedId={selected?.id ?? selectedId}
          streamingAgentId={streamingAgentId}
          onSelect={selectAgent}
        />
        <main className="chat-main">
          {loadError ? (
            <div className="chat-load-error">{loadError}</div>
          ) : agents.length > 0 ? (
            agents.map((agent) =>
              visitedAgentIds.includes(agent.id) ? (
                <AgentChatPane
                  key={agent.id}
                  agent={agent}
                  hidden={agent.id !== selected?.id}
                  restoreChatId={lastChatByAgent[agent.id] ?? null}
                  schedulesOpen={
                    agent.id === "omni" ? omniSchedulesOpen : false
                  }
                  onSchedulesOpenChange={
                    agent.id === "omni" ? setOmniSchedulesOpen : undefined
                  }
                  onRememberChat={rememberAgentChat}
                  onStreamingChange={setStreamingAgentId}
                />
              ) : null,
            )
          ) : (
            <div className="chat-load-error">Loading agents…</div>
          )}
        </main>
      </div>
    </div>
  );
}
