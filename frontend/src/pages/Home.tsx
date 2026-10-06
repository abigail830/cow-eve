import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getCachedAgents, loadAgentsCatalog, type AgentInfo } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PlatformAmbient } from "../components/PlatformAmbient";
import { PlatformBrand } from "../components/PlatformBrand";
import { UserAccountMenu } from "../components/UserAccountMenu";
import { AgentDisplayName } from "../lib/agentDisplayName";
import "./Home.css";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

export function HomePage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentInfo[]>(() => getCachedAgents());
  const [agentsLoading, setAgentsLoading] = useState(
    () => getCachedAgents().length === 0,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    loadAgentsCatalog()
      .then((list) => {
        if (!cancelled) setAgents(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load agents",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setAgentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token || !user) return <Navigate to="/login" replace />;

  return (
    <div className="home-shell platform-shell">
      <PlatformAmbient />
      <header className="home-header">
        <PlatformBrand variant="header" />
        <div className="home-header-actions">
          <UserAccountMenu
            minimal
            userName={user.displayName}
            userEmail={user.email}
            onOpenSettings={() => navigate("/settings")}
            onLogout={logout}
          />
        </div>
      </header>

      <main className="home-main">
        <div className="home-hero">
          <h1 className="home-greeting">
            {greeting}, {firstName(user.displayName)}
          </h1>
          <p className="home-lead">Choose an agent to start working.</p>
        </div>

        {loadError ? (
          <p className="home-error" role="alert">
            {loadError}
          </p>
        ) : agentsLoading && agents.length === 0 ? (
          <p className="home-muted">Loading agents…</p>
        ) : agents.length === 0 ? (
          <p className="home-muted">No agents available.</p>
        ) : (
          <div className="home-agent-row-wrap">
            <div className="home-agent-row">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className="home-agent-card"
                  onClick={() =>
                    navigate(`/agents/${encodeURIComponent(agent.id)}`)
                  }
                >
                  <span className="home-agent-card-avatar">
                    <img src={agent.avatar} alt="" width={64} height={64} />
                  </span>
                  <AgentDisplayName
                    displayName={agent.displayName}
                    className="home-agent-card-name"
                    highlightClassName="home-agent-card-name-highlight"
                  />
                  <span className="home-agent-card-desc">{agent.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="home-footer">
        <p>Connect once. Work smarter together.</p>
      </footer>
    </div>
  );
}
