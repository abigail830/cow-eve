import { useEffect, useState, type FormEvent } from "react";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
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
      return "运行中";
    case "success":
      return "成功";
    case "failed":
      return "失败";
    case "pending":
      return "待运行";
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

type Props = {
  onOpenResultChat?: (chatId: string) => void;
};

export function SchedulePanel({ onOpenResultChat }: Props) {
  const [schedules, setSchedules] = useState<ScheduledTaskPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSchedules();
      setSchedules(res.schedules);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

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
          name: form.name.trim() || undefined,
          prompt: form.prompt.trim(),
          firstRunAt: localInputToIso(form.firstRunAt),
          everyMinutes,
          timezone: form.timezone,
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(defaultFormState());
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setPending(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm(defaultFormState());
    setShowForm(true);
  }

  function startEdit(task: ScheduledTaskPublic) {
    setEditingId(task.id);
    setForm(formFromSchedule(task));
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定删除这个定时任务？")) return;
    setPending(true);
    setError(null);
    try {
      await deleteSchedule(id);
      if (editingId === id) {
        setShowForm(false);
        setEditingId(null);
        setForm(defaultFormState());
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
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
      setError(err instanceof Error ? err.message : "更新失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="schedule-panel">
      <div className="schedule-panel-toolbar">
        <div className="schedule-panel-title">
          <Clock size={18} strokeWidth={2} aria-hidden />
          <h3>定时任务</h3>
        </div>
        <button
          type="button"
          className="schedule-panel-create"
          onClick={startCreate}
          disabled={pending}
        >
          <Plus size={15} strokeWidth={2} />
          新建任务
        </button>
      </div>

      <p className="schedule-panel-hint">
        到点后 haoyu-omni 会自动执行提示词，结果会出现在新的对话中。
      </p>

      {error ? <p className="chat-error">{error}</p> : null}

      {showForm ? (
        <section className="schedule-panel-form-wrap">
          <h4>{editingId ? "编辑任务" : "新建任务"}</h4>
          <form className="schedule-panel-form" onSubmit={handleSubmit}>
            <label>
              名称（可选）
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="例如：每周健康摘要"
              />
            </label>
            <label>
              提示词
              <textarea
                value={form.prompt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, prompt: e.target.value }))
                }
                rows={4}
                required
                placeholder="到点后 omni 将执行的指令"
              />
            </label>
            <label>
              首次运行时间
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
              时区
              <input
                value={form.timezone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, timezone: e.target.value }))
                }
              />
            </label>
            <fieldset className="schedule-panel-repeat">
              <legend>重复</legend>
              <label>
                <input
                  type="radio"
                  checked={form.repeatKind === "once"}
                  onChange={() =>
                    setForm((prev) => ({ ...prev, repeatKind: "once" }))
                  }
                />
                一次性
              </label>
              <label>
                <input
                  type="radio"
                  checked={form.repeatKind === "repeat"}
                  onChange={() =>
                    setForm((prev) => ({ ...prev, repeatKind: "repeat" }))
                  }
                />
                重复
              </label>
              {form.repeatKind === "repeat" ? (
                <label>
                  间隔（分钟）
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
            {editingId ? (
              <label className="schedule-panel-enabled">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                />
                启用
              </label>
            ) : null}
            <div className="schedule-panel-form-actions">
              <button type="submit" className="schedule-primary" disabled={pending}>
                {pending ? "保存中…" : "保存"}
              </button>
              <button
                type="button"
                className="schedule-secondary"
                disabled={pending}
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(defaultFormState());
                }}
              >
                取消
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="schedule-panel-list">
        {loading ? (
          <p className="schedule-muted">加载中…</p>
        ) : schedules.length === 0 ? (
          <p className="schedule-muted">还没有定时任务。点击「新建任务」开始。</p>
        ) : (
          <ul className="schedule-list">
            {schedules.map((task) => (
              <li key={task.id} className="schedule-item">
                <div className="schedule-item-main">
                  <div className="schedule-item-title">
                    <strong>{task.name || "未命名任务"}</strong>
                    <span
                      className={
                        task.enabled
                          ? "schedule-badge enabled"
                          : "schedule-badge disabled"
                      }
                    >
                      {task.enabled ? "启用" : "暂停"}
                    </span>
                    <span
                      className={`schedule-badge status-${task.lastStatus ?? "none"}`}
                    >
                      {statusLabel(task.lastStatus)}
                    </span>
                  </div>
                  <p className="schedule-item-prompt">{task.prompt}</p>
                  <div className="schedule-item-meta">
                    <span>下次运行：{formatDateTime(task.nextRunAt)}</span>
                    <span>
                      {task.everyMinutes == null
                        ? "一次性"
                        : `每 ${task.everyMinutes} 分钟`}
                    </span>
                    {task.lastRunAt ? (
                      <span>上次运行：{formatDateTime(task.lastRunAt)}</span>
                    ) : null}
                    {task.lastError ? (
                      <span className="schedule-item-error">{task.lastError}</span>
                    ) : null}
                  </div>
                </div>
                <div className="schedule-item-actions">
                  {task.lastChatId ? (
                    <button
                      type="button"
                      onClick={() => onOpenResultChat?.(task.lastChatId!)}
                    >
                      查看结果
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleEnabled(task)}
                    disabled={pending}
                  >
                    {task.enabled ? "暂停" : "启用"}
                  </button>
                  <button type="button" onClick={() => startEdit(task)}>
                    <Pencil size={14} strokeWidth={2} />
                    编辑
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => void handleDelete(task.id)}
                    disabled={pending}
                  >
                    <Trash2 size={14} strokeWidth={2} />
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
