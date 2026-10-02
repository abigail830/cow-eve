import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createSchedule,
  deleteSchedule,
  fetchSchedules,
  updateSchedule,
  type ScheduledTaskPublic,
} from "../lib/api";
import "./SchedulePanel.css";

type FormState = {
  name: string;
  prompt: string;
  firstRunAt: string;
  repeatKind: "once" | "repeat";
  everyMinutes: number;
  timezone: string;
  enabled: boolean;
};

const DEFAULT_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultFormState(): FormState {
  const first = new Date(Date.now() + 60 * 60_000);
  return {
    name: "",
    prompt: "",
    firstRunAt: toLocalInputValue(first),
    repeatKind: "once",
    everyMinutes: 1440,
    timezone: DEFAULT_TIMEZONE,
    enabled: true,
  };
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function statusLabel(status: string | null) {
  switch (status) {
    case "running":
      return "Running";
    case "success":
      return "Success";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    default:
      return status ?? "—";
  }
}

function formFromSchedule(task: ScheduledTaskPublic): FormState {
  return {
    name: task.name ?? "",
    prompt: task.prompt,
    firstRunAt: toLocalInputValue(new Date(task.nextRunAt)),
    repeatKind: task.everyMinutes == null ? "once" : "repeat",
    everyMinutes: task.everyMinutes ?? 1440,
    timezone: task.timezone,
    enabled: task.enabled,
  };
}

function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

type TaskFormProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  editing: boolean;
  pending: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
};

function ScheduleTaskForm({
  form,
  setForm,
  editing,
  pending,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  return (
    <form className="schedule-panel-form" onSubmit={onSubmit}>
      <label>
        Name (optional)
        <input
          value={form.name}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="e.g. Weekly health summary"
        />
      </label>
      <label>
        Prompt
        <textarea
          value={form.prompt}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, prompt: e.target.value }))
          }
          rows={4}
          required
          placeholder="Instructions omni runs at the scheduled time"
        />
      </label>
      <label>
        First run
        <input
          type="datetime-local"
          value={form.firstRunAt}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, firstRunAt: e.target.value }))
          }
          required
        />
      </label>
      <label>
        Time zone
        <input
          value={form.timezone}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, timezone: e.target.value }))
          }
        />
      </label>
      <fieldset className="schedule-panel-repeat">
        <legend>Repeat</legend>
        <label>
          <input
            type="radio"
            name={`repeat-${editing ? "edit" : "new"}`}
            checked={form.repeatKind === "once"}
            onChange={() =>
              setForm((prev) => ({ ...prev, repeatKind: "once" }))
            }
          />
          One-time
        </label>
        <label>
          <input
            type="radio"
            name={`repeat-${editing ? "edit" : "new"}`}
            checked={form.repeatKind === "repeat"}
            onChange={() =>
              setForm((prev) => ({ ...prev, repeatKind: "repeat" }))
            }
          />
          Repeating
        </label>
        {form.repeatKind === "repeat" ? (
          <label>
            Interval (minutes)
            <input
              type="number"
              min={1}
              max={525600}
              value={form.everyMinutes}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  everyMinutes: Number(e.target.value),
                }))
              }
            />
          </label>
        ) : null}
      </fieldset>
      {editing ? (
        <label className="schedule-panel-enabled">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, enabled: e.target.checked }))
            }
          />
          Enabled
        </label>
      ) : null}
      <div className="schedule-panel-form-actions">
        <button type="submit" className="schedule-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="schedule-secondary"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

type Props = {
  agentId?: string;
  onOpenResultChat?: (
    chatId: string,
    task: ScheduledTaskPublic,
  ) => void;
  showCreateButton?: boolean;
};

export type SchedulePanelHandle = {
  openCreate: () => void;
};

export const SchedulePanel = forwardRef<SchedulePanelHandle, Props>(
  function SchedulePanel(
    { agentId = "omni", onOpenResultChat, showCreateButton = true },
    ref,
  ) {
  const [schedules, setSchedules] = useState<ScheduledTaskPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [showCreateForm, setShowCreateForm] = useState(false);

  function resetFormState() {
    setEditingId(null);
    setShowCreateForm(false);
    setForm(defaultFormState());
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSchedules(agentId);
      setSchedules(res.schedules);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [agentId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const everyMinutes =
        form.repeatKind === "once" ? null : form.everyMinutes;
      if (editingId) {
        await updateSchedule(editingId, {
          name: form.name.trim() || null,
          prompt: form.prompt.trim(),
          nextRunAt: localInputToIso(form.firstRunAt),
          everyMinutes,
          enabled: form.enabled,
          timezone: form.timezone,
        });
      } else {
        await createSchedule({
          agentId,
          name: form.name.trim() || undefined,
          prompt: form.prompt.trim(),
          firstRunAt: localInputToIso(form.firstRunAt),
          everyMinutes,
          timezone: form.timezone,
        });
      }
      resetFormState();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm(defaultFormState());
    setShowCreateForm(true);
  }

  useImperativeHandle(ref, () => ({ openCreate: startCreate }));

  function startEdit(task: ScheduledTaskPublic) {
    setShowCreateForm(false);
    setEditingId(task.id);
    setForm(formFromSchedule(task));
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this scheduled task?")) return;
    setPending(true);
    setError(null);
    try {
      await deleteSchedule(id);
      if (editingId === id) {
        resetFormState();
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setPending(false);
    }
  }

  async function toggleEnabled(task: ScheduledTaskPublic) {
    setPending(true);
    setError(null);
    try {
      await updateSchedule(task.id, { enabled: !task.enabled });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="schedule-panel">
      {showCreateButton ? (
        <div className="schedule-panel-toolbar">
          <button
            type="button"
            className="schedule-panel-create"
            onClick={startCreate}
            disabled={pending}
          >
            <Plus size={15} strokeWidth={2} />
            New task
          </button>
        </div>
      ) : null}

      {error ? <p className="chat-error">{error}</p> : null}

      {showCreateForm ? (
        <section className="schedule-panel-form-wrap">
          <h4>New task</h4>
          <ScheduleTaskForm
            form={form}
            setForm={setForm}
            editing={false}
            pending={pending}
            onSubmit={handleSubmit}
            onCancel={resetFormState}
          />
        </section>
      ) : null}

      <section className="schedule-panel-list">
        {loading ? (
          <div className="schedule-state-center" role="status">
            <p className="schedule-muted">Loading…</p>
          </div>
        ) : schedules.length === 0 && !showCreateForm ? (
          <div className="schedule-state-center">
            <p className="schedule-muted">
              No scheduled tasks yet.
            </p>
          </div>
        ) : (
          <ul className="schedule-list">
            {schedules.map((task) =>
              editingId === task.id ? (
                <li key={task.id} className="schedule-card schedule-card-editing">
                  <h4 className="schedule-item-edit-title">Edit task</h4>
                  <ScheduleTaskForm
                    form={form}
                    setForm={setForm}
                    editing
                    pending={pending}
                    onSubmit={handleSubmit}
                    onCancel={resetFormState}
                  />
                </li>
              ) : (
                <li key={task.id} className="schedule-card">
                  <div className="schedule-card-row">
                    <span className="schedule-card-icon" aria-hidden>
                      <CalendarClock size={20} strokeWidth={1.75} />
                    </span>
                    <div className="schedule-card-main">
                      <div className="schedule-card-head">
                        <span className="schedule-card-name">
                          {task.name || "Untitled task"}
                        </span>
                        <div className="schedule-card-actions">
                          <button
                            type="button"
                            className="schedule-card-cta"
                            onClick={() => startEdit(task)}
                          >
                            <Pencil size={14} strokeWidth={2} aria-hidden />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="schedule-card-cta schedule-card-cta-danger"
                            aria-label={`Delete ${task.name || "task"}`}
                            disabled={pending}
                            onClick={() => void handleDelete(task.id)}
                          >
                            <Trash2 size={14} strokeWidth={2} aria-hidden />
                          </button>
                        </div>
                      </div>
                      <p className="schedule-card-desc">{task.prompt}</p>
                      <p className="schedule-card-meta">
                        <span
                          className={
                            task.enabled
                              ? "schedule-badge enabled"
                              : "schedule-badge disabled"
                          }
                        >
                          {task.enabled ? "Enabled" : "Paused"}
                        </span>
                        <span
                          className={`schedule-badge status-${task.lastStatus ?? "none"}`}
                        >
                          {statusLabel(task.lastStatus)}
                        </span>
                        <span>
                          {task.everyMinutes == null
                            ? "One-time"
                            : `Every ${task.everyMinutes} min`}
                        </span>
                        <span>Next {formatDateTime(task.nextRunAt)}</span>
                      </p>
                      {task.lastError ? (
                        <p className="schedule-item-error">{task.lastError}</p>
                      ) : null}
                      <div className="schedule-card-footer">
                        {task.lastChatId ? (
                          <button
                            type="button"
                            className="schedule-card-cta"
                            onClick={() =>
                              onOpenResultChat?.(task.lastChatId!, task)
                            }
                          >
                            View result
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="schedule-card-cta"
                          disabled={pending}
                          onClick={() => void toggleEnabled(task)}
                        >
                          {task.enabled ? "Pause" : "Enable"}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
},
);
