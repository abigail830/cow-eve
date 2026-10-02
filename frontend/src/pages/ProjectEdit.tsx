import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { fetchAgents, type AgentInfo } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AgentNav } from "../components/AgentNav";
import { ProjectEditor } from "../components/ProjectEditor";
import {
  fetchWorkspaceFolders,
  type WorkspaceFolderPublic,
} from "../lib/workspace";
import "./Agent.css";
import "./ProjectEdit.css";

export function ProjectEditPage() {
  const { agentId, projectId } = useParams<{
    agentId: string;
    projectId: string;
  }>();
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workspaceFolders, setWorkspaceFolders] = useState<
    WorkspaceFolderPublic[]
  >([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!token) return;
    void fetchWorkspaceFolders()
      .then((folders) => {
        setWorkspaceFolders(folders);
        setSelectedFolderId(folders[0]?.id ?? null);
      })
      .catch(() => undefined);
  }, [token]);

  const backToProjects = useCallback(() => {
    if (!agentId) return;
    navigate(`/agents/${agentId}?view=customize`);
  }, [agentId, navigate]);

  if (!token || !user) return <Navigate to="/login" replace />;

  if (!agentId || !projectId) {
    return <Navigate to="/" replace />;
  }

  const agent = agents.find((a) => a.id === agentId);

  if (agents.length > 0 && !agent) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="agent-shell">
      {agent ? (
        <AgentNav
          agent={agent}
          view="customize"
          onViewChange={(view) => {
            if (view === "work") {
              navigate(`/agents/${agentId}`);
              return;
            }
            if (view === "customize") {
              navigate(`/agents/${agentId}?view=customize`);
              return;
            }
            navigate(`/agents/${agentId}?view=${view}`);
          }}
          workspaceFolders={workspaceFolders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={(id) => {
            setSelectedFolderId(id);
            navigate(`/agents/${agentId}?view=workspace`);
          }}
          onCreateFolder={() => undefined}
          onRenameFolder={() => undefined}
          onDeleteFolder={() => undefined}
          userName={user.displayName}
          userEmail={user.email}
          onOpenSettings={() => navigate("/settings")}
          onLogout={logout}
        />
      ) : (
        <aside className="agent-nav agent-nav-loading" aria-hidden />
      )}

      <main className="agent-main">
        {loadError ? (
          <div className="agent-load-error">{loadError}</div>
        ) : !agent ? (
          <div className="agent-load-error">Loading agent…</div>
        ) : (
          <div className="project-edit-page">
            <header className="project-edit-header">
              <button
                type="button"
                className="project-edit-back"
                onClick={backToProjects}
              >
                <ArrowLeft size={16} strokeWidth={2} aria-hidden />
                Projects
              </button>
              <h1 className="project-edit-title">Edit project</h1>
            </header>
            <div className="project-edit-body">
              <ProjectEditor projectId={projectId} agentId={agent.id} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
