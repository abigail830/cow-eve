import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  getCachedAgents,
  loadAgentsCatalog,
  placeholderAgent,
  type AgentInfo,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { AgentShell } from "../components/AgentShell";
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
  const location = useLocation();

  const [agents, setAgents] = useState<AgentInfo[]>(() => getCachedAgents());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workspaceFolders, setWorkspaceFolders] = useState<
    WorkspaceFolderPublic[]
  >([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

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
    const returnTo = (
      location.state as { returnTo?: string } | null
    )?.returnTo?.trim();
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    navigate(`/agents/${agentId}?view=customize`);
  }, [agentId, location.state, navigate]);

  if (!token || !user) return <Navigate to="/login" replace />;

  if (!agentId || !projectId) {
    return <Navigate to="/" replace />;
  }

  const agentRecord = agents.find((a) => a.id === agentId);
  const agent =
    agentRecord ?? (agentId ? placeholderAgent(agentId) : undefined);

  if (agents.length > 0 && agentId && !agentRecord) {
    return <Navigate to="/" replace />;
  }

  if (!agent) {
    return <Navigate to="/" replace />;
  }

  return (
    <AgentShell
      nav={
        {
              agent,
              view: "customize",
              onViewChange: (view) => {
                if (view === "work") {
                  navigate(`/agents/${agentId}`);
                  return;
                }
                if (view === "customize") {
                  navigate(`/agents/${agentId}?view=customize`);
                  return;
                }
                navigate(`/agents/${agentId}?view=${view}`);
              },
              workspaceFolders,
              selectedFolderId,
              onSelectFolder: (id) => {
                setSelectedFolderId(id);
                navigate(`/agents/${agentId}?view=workspace`);
              },
              onCreateFolder: () => undefined,
              onRenameFolder: () => undefined,
              onDeleteFolder: () => undefined,
              userName: user.displayName,
              userEmail: user.email,
              agents,
              onGoHome: () => navigate("/"),
              onSwitchAgent: (id) =>
                navigate(`/agents/${encodeURIComponent(id)}`),
              onOpenSettings: () => navigate("/settings"),
              onLogout: logout,
            }
      }
    >
        {loadError ? (
          <div className="agent-load-error">{loadError}</div>
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
    </AgentShell>
  );
}
