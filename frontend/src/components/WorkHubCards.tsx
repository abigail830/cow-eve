import { useMemo, useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2, Plus, Target } from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  fetchScheduleSummary,
  type ScheduledTaskPublic,
} from "../lib/api";
import {
  createProject,
  fetchProjectSummary,
  type ProjectPublic,
} from "../lib/projects";
import "./WorkHubCards.css";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

type Props = {
  agentId: string;
  onOpenSchedules: () => void;
  onOpenProjects: () => void;
  onOpenScheduleResult: (chatId: string) => void;
  onEnterProject: (projectId: string) => void;
};

export function WorkHubCards({
  agentId,
  onOpenSchedules,
  onOpenProjects,
  onOpenScheduleResult,
  onEnterProject,
}: Props) {
  const { user } = useAuth();
  const greeting = useMemo(() => {
    const hello = greetingForHour(new Date().getHours());
    const name = user?.displayName ? firstName(user.displayName) : "";
    return name ? `${hello}, ${name}` : hello;
  }, [user?.displayName]);
  const [schedules, setSchedules] = useState<ScheduledTaskPublic[]>([]);
  const [projects, setProjects] = useState<ProjectPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedRes, projList] = await Promise.all([
        fetchScheduleSummary(agentId, 3),
        fetchProjectSummary(agentId, 3),
      ]);
      setSchedules(schedRes.schedules);
      setProjects(projList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load work hub");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreateProject() {
    const name = window.prompt("Project name");
    if (!name?.trim()) return;
    try {
      const project = await createProject({
        agentId,
        name: name.trim(),
      });
      await reload();
      onEnterProject(project.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create project");
    }
  }

  if (loading) {
    return (
      <div className="work-hub-state-center" role="status">
        <Loader2 size={22} className="work-hub-spin" aria-hidden />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="work-hub">
      {error ? (
        <p className="work-hub-error" role="alert">
          {error}
        </p>
      ) : null}
      <header className="work-hub-intro">
        <h2 className="work-hub-greeting">{greeting}</h2>
        <p className="work-hub-hint">
          Start typing below for a generic chat, or pick a schedule or project.
        </p>
      </header>
      <div className="work-hub-grid">
        <section className="work-hub-card" aria-labelledby="work-hub-sched-title">
          <header className="work-hub-card-header">
            <h3 id="work-hub-sched-title" className="work-hub-card-title">
              <CalendarClock size={18} strokeWidth={2} aria-hidden />
              Scheduled tasks
            </h3>
            <div className="work-hub-card-actions">
              <button type="button" className="work-hub-link" onClick={onOpenSchedules}>
                View all
              </button>
              <button
                type="button"
                className="work-hub-icon-btn"
                aria-label="New scheduled task"
                title="New task"
                onClick={onOpenSchedules}
              >
                <Plus size={16} strokeWidth={2} />
              </button>
            </div>
          </header>
          <ul className="work-hub-list">
            {schedules.length === 0 ? (
              <li className="work-hub-empty">No scheduled tasks yet.</li>
            ) : (
              schedules.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className="work-hub-list-item"
                    onClick={() => {
                      if (task.lastChatId) onOpenScheduleResult(task.lastChatId);
                      else onOpenSchedules();
                    }}
                  >
                    <span className="work-hub-list-title">
                      {task.name?.trim() || "Scheduled task"}
                    </span>
                    <span className="work-hub-list-meta">
                      {task.lastRunAt
                        ? `Last run ${new Date(task.lastRunAt).toLocaleString()}`
                        : "Not run yet"}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="work-hub-card" aria-labelledby="work-hub-proj-title">
          <header className="work-hub-card-header">
            <h3 id="work-hub-proj-title" className="work-hub-card-title">
              <Target size={18} strokeWidth={2} aria-hidden />
              Projects
            </h3>
            <div className="work-hub-card-actions">
              <button type="button" className="work-hub-link" onClick={onOpenProjects}>
                View all
              </button>
              <button
                type="button"
                className="work-hub-icon-btn"
                aria-label="New project"
                title="New project"
                onClick={() => void handleCreateProject()}
              >
                <Plus size={16} strokeWidth={2} />
              </button>
            </div>
          </header>
          <ul className="work-hub-list">
            {projects.length === 0 ? (
              <li className="work-hub-empty">No projects yet.</li>
            ) : (
              projects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    className="work-hub-list-item"
                    onClick={() => onEnterProject(project.id)}
                  >
                    <span className="work-hub-list-title">{project.name}</span>
                    <span className="work-hub-list-meta">
                      Updated {new Date(project.lastActivityAt).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
