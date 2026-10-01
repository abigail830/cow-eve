import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { fetchAgents, type AgentInfo } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PlatformAmbient } from "../components/PlatformAmbient";
import { PlatformBrand } from "../components/PlatformBrand";
import { UserAccountMenu } from "../components/UserAccountMenu";
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
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchAgents()
      .then((res) => {
        if (!cancelled) setAgents(res.agents);
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

  return (
    <div className="home-shell platform-shell">
      <PlatformAmbient />
      <header className="home-header">
        <PlatformBrand variant="header" />
        <UserAccountMenu
          minimal
          userName={user.displayName}
          userEmail={user.email}
          onOpenSettings={() => navigate("/settings")}
          onLogout={logout}
        />
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
        ) : agents.length === 0 ? (
          <p className="home-muted">Loading agents…</p>
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
                    <img src={agent.avatar} alt="" width={72} height={72} />
                  </span>
                  <span className="home-agent-card-name">{agent.displayName}</span>
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
