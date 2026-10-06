import { useCallback, useEffect, useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  getCachedAgents,
  loadAgentsCatalog,
  placeholderAgent,
  scheduleTaskLabel,
  type AgentInfo,
  type ScheduledTaskPublic,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { AgentChat } from "../components/AgentChat";
import { AgentShell } from "../components/AgentShell";
import { type AgentNavView } from "../components/AgentNav";
import { ArtifactsPanel } from "../components/ArtifactsPanel";
import {
  CustomizePanel,
  type CustomizeTab,
} from "../components/CustomizePanel";
import { WorkspacePanel } from "../components/WorkspacePanel";
import {
  createWorkspaceFolder,
  deleteWorkspaceFolder,
  fetchWorkspaceFolders,
  renameWorkspaceFolder,
  type WorkspaceFolderPublic,
} from "../lib/workspace";
import "./Agent.css";

function customizeTabFromSearch(
  viewParam: string | null,
  tabParam: string | null,
): CustomizeTab {
  if (viewParam === "automation" || tabParam === "schedules") return "schedules";
  if (
    tabParam === "integrations" ||
    (viewParam === "integrations" && !tabParam)
  ) {
    return "integrations";
  }
  return "projects";
}

export function AgentPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [agents, setAgents] = useState<AgentInfo[]>(() => getCachedAgents());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoreChatId, setRestoreChatId] = useState<string | null>(null);
  const [scheduleView, setScheduleView] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [streaming, setStreaming] = useState(false);

  const projectId = searchParams.get("project")?.trim() || null;

  const setProjectId = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("project", id);
          else next.delete("project");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const viewParam = searchParams.get("view");
  const view: AgentNavView =
    viewParam === "workspace"
      ? "workspace"
      : viewParam === "customize" ||
          viewParam === "integrations" ||
          viewParam === "automation"
        ? "customize"
        : viewParam === "artifacts"
          ? "artifacts"
          : "work";

  const setView = useCallback(
    (next: AgentNavView) => {
      setSearchParams(
        next === "work"
          ? {}
          : { view: next },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [workspaceFolders, setWorkspaceFolders] = useState<
    WorkspaceFolderPublic[]
  >([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const reloadWorkspaceFolders = useCallback(async () => {
    try {
      const folders = await fetchWorkspaceFolders();
      setWorkspaceFolders(folders);
      setSelectedFolderId((prev) => {
        if (prev && folders.some((f) => f.id === prev)) return prev;
        return folders[0]?.id ?? null;
      });
      setWorkspaceError(null);
    } catch (err: unknown) {
      setWorkspaceError(
        err instanceof Error ? err.message : "Failed to load workspace",
      );
    }
  }, []);

  useEffect(() => {
    if (!token || view !== "workspace") return;
    void reloadWorkspaceFolders();
  }, [token, view, reloadWorkspaceFolders]);

  const handleCreateWorkspaceFolder = useCallback(async () => {
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;
    try {
      const folder = await createWorkspaceFolder(name.trim());
      await reloadWorkspaceFolders();
      setSelectedFolderId(folder.id);
      setView("workspace");
    } catch (err: unknown) {
      setWorkspaceError(
        err instanceof Error ? err.message : "Could not create folder",
      );
    }
  }, [reloadWorkspaceFolders, setView]);

  const handleRenameWorkspaceFolder = useCallback(async () => {
    const folder = workspaceFolders.find((f) => f.id === selectedFolderId);
    if (!folder) return;
    const name = window.prompt("Folder name", folder.name);
    if (!name?.trim() || name.trim() === folder.name) return;
    try {
      await renameWorkspaceFolder(folder.id, name.trim());
      await reloadWorkspaceFolders();
      setWorkspaceError(null);
    } catch (err: unknown) {
      setWorkspaceError(
        err instanceof Error ? err.message : "Could not rename folder",
      );
    }
  }, [reloadWorkspaceFolders, selectedFolderId, workspaceFolders]);

  const handleDeleteWorkspaceFolder = useCallback(async () => {
    const folder = workspaceFolders.find((f) => f.id === selectedFolderId);
    if (!folder) return;
    if (
      !window.confirm(`Delete folder "${folder.name}"? It must be empty.`)
    ) {
      return;
    }
    try {
      await deleteWorkspaceFolder(folder.id);
      await reloadWorkspaceFolders();
      setWorkspaceError(null);
    } catch (err: unknown) {
      setWorkspaceError(
        err instanceof Error ? err.message : "Could not delete folder",
      );
    }
  }, [reloadWorkspaceFolders, selectedFolderId, workspaceFolders]);

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
    const state = location.state as
      | {
          restoreChatId?: string;
          openSchedules?: boolean;
        }
      | null
      | undefined;
    if (!state) return;

    if (state.restoreChatId) {
      setRestoreChatId(state.restoreChatId);
    }

    if (state.openSchedules || state.restoreChatId) {
      const params = new URLSearchParams(location.search);
      if (state.openSchedules) {
        params.set("view", "customize");
        params.set("tab", "schedules");
      }
      const search = params.toString();
      navigate(`${location.pathname}${search ? `?${search}` : ""}`, {
        replace: true,
        state: null,
      });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (view !== "work" || !restoreChatId) return;
    setRestoreChatId(null);
  }, [view, restoreChatId]);

  if (!token || !user) return <Navigate to="/login" replace />;

  const agentRecord = agents.find((a) => a.id === agentId);
  const agent =
    agentRecord ?? (agentId ? placeholderAgent(agentId) : undefined);

  if (agents.length > 0 && agentId && !agentRecord) {
    return <Navigate to="/" replace />;
  }

  if (!agentId || !agent) {
    return <Navigate to="/" replace />;
  }

  return (
    <AgentShell
      nav={
        {
              agent,
              view,
              onViewChange: setView,
              streaming,
              workspaceFolders,
              selectedFolderId,
              onSelectFolder: (id) => {
                setSelectedFolderId(id);
                setView("workspace");
              },
              onCreateFolder: () => void handleCreateWorkspaceFolder(),
              onRenameFolder: () => void handleRenameWorkspaceFolder(),
              onDeleteFolder: () => void handleDeleteWorkspaceFolder(),
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
        ) : view === "customize" ? (
          <CustomizePanel
            agentId={agent.id}
            tab={customizeTabFromSearch(viewParam, searchParams.get("tab"))}
            onTabChange={(tab: CustomizeTab) => {
              setSearchParams(
                tab === "schedules"
                  ? { view: "customize", tab: "schedules" }
                  : tab === "integrations"
                    ? { view: "customize", tab: "integrations" }
                    : { view: "customize" },
                { replace: true },
              );
            }}
            onEnterProject={(projectId) => {
              setSearchParams({ project: projectId }, { replace: true });
            }}
            onEditProject={(id) => {
              navigate(`/agents/${agent.id}/projects/${id}/edit`, {
                state: {
                  returnTo: `/agents/${agent.id}?view=customize`,
                },
              });
            }}
            onOpenScheduleResult={(task: ScheduledTaskPublic, chatId: string) => {
              setScheduleView({
                id: task.id,
                label: scheduleTaskLabel(task),
              });
              setRestoreChatId(chatId);
              setView("work");
            }}
          />
        ) : view === "artifacts" ? (
          <ArtifactsPanel agentId={agent.id} />
        ) : view === "workspace" ? (
          workspaceError ? (
            <div className="agent-load-error">{workspaceError}</div>
          ) : (
            <WorkspacePanel
              folders={workspaceFolders}
              selectedFolderId={selectedFolderId}
            />
          )
        ) : (
          <AgentChat
            agent={agent}
            restoreChatId={restoreChatId}
            scheduleView={scheduleView}
            onScheduleViewChange={setScheduleView}
            onOpenSchedules={() =>
              setSearchParams(
                { view: "customize", tab: "schedules" },
                { replace: true },
              )
            }
            onOpenProjects={() =>
              setSearchParams(
                { view: "customize", tab: "projects" },
                { replace: true },
              )
            }
            projectId={projectId}
            onProjectIdChange={setProjectId}
            onActiveChatChange={() => {
              /* chat id tracked inside AgentChat */
            }}
            onStreamingChange={setStreaming}
          />
        )}
    </AgentShell>
  );
}
