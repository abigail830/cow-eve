import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { fetchAgents, type AgentInfo } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AgentChat } from "../components/AgentChat";
import { AppHeader } from "../components/AppHeader";
import { Sidebar } from "../components/Sidebar";
import "./Chat.css";

export function ChatPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("omni");
  const [streamingAgentId, setStreamingAgentId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Last opened chat per agent; survives agent switches (AgentChat unmounts). */
  const [lastChatByAgent, setLastChatByAgent] = useState<
    Record<string, string>
  >({});

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

  const handleActiveChatChange = useCallback(
    (chatId: string | null) => {
      if (!selected) return;
      rememberAgentChat(selected.id, chatId);
    },
    [rememberAgentChat, selected?.id],
  );

  return (
    <div className="app-shell">
      <AppHeader
        activeModule="agent-team"
        agentCount={agents.length}
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
          onSelect={setSelectedId}
        />
        <main className="chat-main">
          {loadError ? (
            <div className="chat-load-error">{loadError}</div>
          ) : selected ? (
            <AgentChat
              key={selected.id}
              agent={selected}
              restoreChatId={lastChatByAgent[selected.id] ?? null}
              onActiveChatChange={handleActiveChatChange}
              onStreamingChange={(streaming) => {
                setStreamingAgentId(streaming ? selected.id : null);
              }}
            />
          ) : (
            <div className="chat-load-error">Loading agents…</div>
          )}
        </main>
      </div>
    </div>
  );
}
