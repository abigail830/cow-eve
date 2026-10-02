import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
};

export function ProjectListPanel({ agentId, onEnterProject }: Props) {
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

  async function handleCreate() {
    const name = window.prompt("Project name");
    if (!name?.trim()) return;
    setPending(true);
    setError(null);
    try {
      const project = await createProject({ agentId, name: name.trim() });
      await reload();
      onEnterProject(project.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setPending(false);
    }
  }

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
      await deleteProject(project.id);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete project");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="project-list-panel">
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
          {projects.map((project) => (
            <li key={project.id} className="project-list-item">
              <button
                type="button"
                className="project-list-item-main"
                disabled={pending}
                onClick={() => onEnterProject(project.id)}
              >
                <strong>{project.name}</strong>
                <span className="project-list-item-meta">
                  Updated {new Date(project.lastActivityAt).toLocaleString()}
                </span>
              </button>
              <button
                type="button"
                className="project-list-item-delete danger"
                aria-label={`Delete project ${project.name}`}
                disabled={pending}
                onClick={() => void handleDelete(project)}
              >
                <Trash2 size={15} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
