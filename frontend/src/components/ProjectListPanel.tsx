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
import "./ProjectListPanel.css";

type Props = {
  agentId: string;
  onEnterProject: (projectId: string) => void;
  onEditProject?: (projectId: string) => void;
  showCreateButton?: boolean;
};

export type ProjectListHandle = {
  openCreate: () => void;
};

export const ProjectListPanel = forwardRef<ProjectListHandle, Props>(
  function ProjectListPanel(
    { agentId, onEnterProject, onEditProject, showCreateButton = true },
    ref,
  ) {
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
        <ul className="project-list">
          {projects.map((project) => {
            const summary = project.instructions.trim();
            return (
              <li key={project.id} className="project-card">
                <div className="project-card-row">
                  <span className="project-card-icon" aria-hidden>
                    <Target size={20} strokeWidth={1.75} />
                  </span>
                  <div className="project-card-main">
                    <div className="project-card-head">
                      <span className="project-card-name">{project.name}</span>
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
                    <div className="project-card-foot">
                      <p className="project-card-meta">
                        Updated{" "}
                        {new Date(project.lastActivityAt).toLocaleString()}
                      </p>
                      <button
                        type="button"
                        className="project-card-start"
                        disabled={pending}
                        onClick={() => onEnterProject(project.id)}
                      >
                        Start work
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
},
);
