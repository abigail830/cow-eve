import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Loader2, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";
import {
  createProject,
  deleteProject,
  fetchProjects,
  type ProjectPublic,
} from "../lib/projects";
import {
  readCustomizeViewMode,
  writeCustomizeViewMode,
  type CustomizeResourceViewMode,
} from "../lib/customize-view-mode";
import { plainSummary } from "../lib/plain-summary";
import { CustomizeViewToggle } from "./CustomizeViewToggle";
import "./CustomizeResourceList.css";
import "./ProjectListPanel.css";

type Props = {
  agentId: string;
  viewMode?: CustomizeResourceViewMode;
  onEnterProject: (projectId: string) => void;
  onEditProject?: (projectId: string) => void;
  showCreateButton?: boolean;
};

export type ProjectListHandle = {
  openCreate: () => void;
};

export const ProjectListPanel = forwardRef<ProjectListHandle, Props>(
  function ProjectListPanel(
    {
      agentId,
      viewMode: viewModeProp,
      onEnterProject,
      onEditProject,
      showCreateButton = true,
    },
    ref,
  ) {
  const [internalView, setInternalView] = useState<CustomizeResourceViewMode>(
    () => readCustomizeViewMode("projects"),
  );
  const viewMode = viewModeProp ?? internalView;
  const viewControlled = viewModeProp !== undefined;

  const [projects, setProjects] = useState<ProjectPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await fetchProjects(agentId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = useCallback(async () => {
    const name = window.prompt("Project name");
    if (!name?.trim()) return;
    setPending(true);
    setError(null);
    try {
      const project = await createProject({ agentId, name: name.trim() });
      await reload();
      if (onEditProject) {
        onEditProject(project.id);
      } else {
        onEnterProject(project.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setPending(false);
    }
  }, [agentId, onEditProject, onEnterProject, reload]);

  useImperativeHandle(
    ref,
    () => ({
      openCreate: () => {
        void handleCreate();
      },
    }),
    [handleCreate],
  );

  async function handleDelete(project: ProjectPublic) {
    if (
      !window.confirm(
        `Delete project "${project.name}"? Chats will stay but lose project scope.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deleteProject(project.id, agentId);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete project");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="project-list-panel">
      {showCreateButton ? (
        <div className="project-list-toolbar">
          {!viewControlled ? (
            <CustomizeViewToggle
              value={viewMode}
              onChange={(mode) => {
                setInternalView(mode);
                writeCustomizeViewMode("projects", mode);
              }}
              label="Projects layout"
            />
          ) : null}
          <button
            type="button"
            className="project-list-create"
            disabled={pending}
            onClick={() => void handleCreate()}
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
            New project
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="project-list-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <div className="project-list-state-center" role="status">
          <Loader2 size={22} className="project-list-spin" aria-hidden />
          <span>Loading projects…</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="project-list-state-center">
          <p className="project-list-muted">No projects yet.</p>
        </div>
      ) : (
        <ul
          className={
            viewMode === "list"
              ? "customize-resource-list"
              : "project-list project-list--card"
          }
        >
          {projects.map((project) => {
            const summary = project.instructions.trim();
            const summaryPlain = plainSummary(summary);

            if (viewMode === "list") {
              return (
                <li key={project.id} className="customize-resource-row">
                  <span className="customize-resource-row-icon" aria-hidden>
                    <Target size={18} strokeWidth={1.75} />
                  </span>
                  <div className="customize-resource-row-body">
                    <h3 className="customize-resource-row-title">
                      {project.name}
                    </h3>
                    <p
                      className={
                        summaryPlain
                          ? "customize-resource-row-subtitle"
                          : "customize-resource-row-subtitle customize-resource-row-subtitle--empty"
                      }
                    >
                      {summaryPlain || "No instructions yet."}
                    </p>
                  </div>
                  <div className="customize-resource-row-actions">
                    {onEditProject ? (
                      <button
                        type="button"
                        className="customize-row-icon-btn"
                        aria-label={`Edit project ${project.name}`}
                        disabled={pending}
                        onClick={() => onEditProject(project.id)}
                      >
                        <Pencil size={15} strokeWidth={2} aria-hidden />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="customize-row-icon-btn customize-row-icon-btn--danger"
                      aria-label={`Delete project ${project.name}`}
                      disabled={pending}
                      onClick={() => void handleDelete(project)}
                    >
                      <Trash2 size={15} strokeWidth={2} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="customize-row-btn customize-row-btn--primary"
                      disabled={pending}
                      onClick={() => onEnterProject(project.id)}
                    >
                      Start work
                    </button>
                  </div>
                </li>
              );
            }

            return (
              <li key={project.id} className="project-card">
                <div className="project-card-inner">
                  <span className="project-card-icon" aria-hidden>
                    <Target size={20} strokeWidth={1.75} />
                  </span>
                  <div className="project-card-main">
                    <div className="project-card-head">
                      <h3 className="project-card-name">{project.name}</h3>
                      <div className="project-card-actions">
                        {onEditProject ? (
                          <button
                            type="button"
                            className="project-card-icon-btn"
                            aria-label={`Edit project ${project.name}`}
                            disabled={pending}
                            onClick={() => onEditProject(project.id)}
                          >
                            <Pencil size={15} strokeWidth={2} aria-hidden />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="project-card-icon-btn project-card-icon-btn--danger"
                          aria-label={`Delete project ${project.name}`}
                          disabled={pending}
                          onClick={() => void handleDelete(project)}
                        >
                          <Trash2 size={15} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </div>
                    <div className="project-card-desc">
                      {summary ? (
                        <MarkdownContent text={summary} />
                      ) : (
                        <p className="project-card-desc-empty">
                          No instructions yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <footer className="project-card-footer">
                  <button
                    type="button"
                    className="project-card-start"
                    disabled={pending}
                    onClick={() => onEnterProject(project.id)}
                  >
                    Start work
                  </button>
                </footer>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
},
);
