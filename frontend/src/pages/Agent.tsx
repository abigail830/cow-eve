import { useCallback, useEffect, useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  fetchAgents,
  scheduleTaskLabel,
  type AgentInfo,
  type ScheduledTaskPublic,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { AgentChat } from "../components/AgentChat";
import { AgentNav, type AgentNavView } from "../components/AgentNav";
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

  const [agents, setAgents] = useState<AgentInfo[]>([]);
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

  const agent = agents.find((a) => a.id === agentId);

  if (agents.length > 0 && !agent) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="agent-shell">
      {agent ? (
        <AgentNav
          agent={agent}
          view={view}
          onViewChange={setView}
          streaming={streaming}
          workspaceFolders={workspaceFolders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={(id) => {
            setSelectedFolderId(id);
            setView("workspace");
          }}
          onCreateFolder={() => void handleCreateWorkspaceFolder()}
          onRenameFolder={() => void handleRenameWorkspaceFolder()}
          onDeleteFolder={() => void handleDeleteWorkspaceFolder()}
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
            onOpenSchedules={
              agent.id === "omni"
                ? () =>
                    setSearchParams(
                      { view: "customize", tab: "schedules" },
                      { replace: true },
                    )
                : undefined
            }
            projectId={projectId}
            onProjectIdChange={setProjectId}
            onActiveChatChange={() => {
              /* chat id tracked inside AgentChat */
            }}
            onStreamingChange={setStreaming}
          />
        )}
      </main>
    </div>
  );
}
