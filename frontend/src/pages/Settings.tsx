import { useEffect, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  Cpu,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import {
  createUser,
  deleteUser,
  fetchModelPresets,
  fetchModelSettings,
  fetchUsers,
  saveModelCatalog,
  type PlatformUserPublic,
  type ModelCatalogPublic,
  type ModelEntryPublic,
  type ModelPreset,
  type ModelReasoning,
} from "../lib/api";
import {
  catalogFromSettings,
  CONTEXT_WINDOW_OPTIONS,
  DEFAULT_MODEL_PRESETS,
  DEFAULT_MODEL_SETTINGS,
  formatContextWindowLabel,
  resolveSavedCatalog,
} from "../lib/model-defaults";
import { IconButton } from "../components/IconButton";
import { useAuth } from "../lib/auth";
import "./Settings.css";

type TabId = "model" | "users";

const REASONING_OPTIONS: ModelReasoning[] = [
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

function formatDateTime(iso: string | null) {
  if (!iso) return "从未登录";
  return new Date(iso).toLocaleString();
}

export function SettingsPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<TabId>("model");

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="settings-page">
      <header className="settings-header">
        <Link to="/" className="settings-back">
          <ChevronLeft size={18} strokeWidth={2} />
          Back
        </Link>
        <h1>Settings</h1>
      </header>

      <div className="settings-shell">
        <nav className="settings-tabs">
          <button
            type="button"
            className={tab === "model" ? "active" : ""}
            onClick={() => setTab("model")}
          >
            <Cpu size={16} strokeWidth={2} />
            Model
          </button>
          <button
            type="button"
            className={tab === "users" ? "active" : ""}
            onClick={() => setTab("users")}
          >
            <Users size={16} strokeWidth={2} />
            Users
          </button>
        </nav>

        <div className="settings-panel">
          {tab === "model" ? <ModelSettingsTab /> : <UsersSettingsTab />}
        </div>
      </div>
    </div>
  );
}

function UsersSettingsTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<PlatformUserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function loadUsers() {
    const res = await fetchUsers();
    setUsers(res.users);
  }

  useEffect(() => {
    let cancelled = false;
    loadUsers()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载用户失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onAddUser(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      await createUser(email.trim(), password);
      await loadUsers();
      setEmail("");
      setPassword("");
      setShowAdd(false);
      setMessage("用户已添加");
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加用户失败");
    } finally {
      setPending(false);
    }
  }

  async function onDeleteUser(target: PlatformUserPublic) {
    if (pending) return;
    if (
      !window.confirm(`确定删除用户 ${target.email}？此操作不可撤销。`)
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      await deleteUser(target.email);
      await loadUsers();
      setMessage("用户已删除");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除用户失败");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="settings-muted">加载用户列表…</p>;
  }

  return (
    <div className="model-settings">
      <div className="model-form-intro">
        <h2>Users</h2>
        <p>
          管理平台登录账号。可添加或删除用户，不支持编辑；密码会以 bcrypt 加密后存储。
        </p>
      </div>

      <div className="model-toolbar">
        <span className="settings-muted">
          {users.length} {users.length === 1 ? "user" : "users"}
        </span>
        <button
          type="button"
          className="model-add"
          onClick={() => {
            setError(null);
            setMessage(null);
            setShowAdd(true);
          }}
          disabled={pending || showAdd}
        >
          <Plus size={15} strokeWidth={2} />
          添加用户
        </button>
      </div>

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>显示名</th>
              <th>上次登录</th>
              <th>创建时间</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((item) => {
              const isSelf =
                currentUser?.email.toLowerCase() === item.email.toLowerCase();
              const isLast = users.length <= 1;
              return (
                <tr key={item.email}>
                  <td className="model-mono">{item.email}</td>
                  <td>{item.displayName}</td>
                  <td>{formatDateTime(item.lastLoginAt)}</td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>
                    <div className="model-row-actions">
                      <IconButton
                        icon={Trash2}
                        label={
                          isSelf
                            ? "不能删除当前登录账号"
                            : isLast
                              ? "至少保留一个用户"
                              : `删除 ${item.email}`
                        }
                        size={16}
                        className="danger"
                        disabled={pending || isSelf || isLast}
                        onClick={() => void onDeleteUser(item)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd ? (
        <form className="model-editor" onSubmit={onAddUser} autoComplete="off">
          <h3>添加用户</h3>
          <div className="model-editor-grid">
            <label className="wide">
              用户名（邮箱）
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                autoComplete="off"
                required
              />
            </label>
            <label className="wide">
              密码
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 位"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          </div>
          <div className="model-editor-actions">
            <button type="submit" disabled={pending}>
              {pending ? "添加中…" : "添加"}
            </button>
            <button
              type="button"
              className="model-cancel"
              onClick={() => {
                setShowAdd(false);
                setEmail("");
                setPassword("");
              }}
              disabled={pending}
            >
              取消
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="settings-error">{error}</p> : null}
      {message ? <p className="settings-ok">{message}</p> : null}
    </div>
  );
}

type DraftModel = {
  id: string;
  presetId: string;
  displayName: string;
  baseURL: string;
  modelId: string;
  contextWindowTokens: number;
  reasoning: ModelReasoning;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  apiKey: string;
};

type EditorState = {
  mode: "add" | "edit";
  draft: DraftModel;
  makeDefault: boolean;
};

function newModelId() {
  return crypto.randomUUID();
}

function toDraft(entry: ModelEntryPublic): DraftModel {
  return { ...entry, apiKey: "" };
}

function blankDraft(preset: ModelPreset): DraftModel {
  return {
    id: newModelId(),
    presetId: preset.id,
    displayName: preset.displayName,
    baseURL: preset.baseURL,
    modelId: preset.modelId,
    contextWindowTokens: preset.contextWindowTokens,
    reasoning: "provider-default",
    hasApiKey: false,
    apiKeyHint: null,
    apiKey: "",
  };
}

function ModelSettingsTab() {
  const [presets, setPresets] = useState<ModelPreset[]>(DEFAULT_MODEL_PRESETS);
  const [models, setModels] = useState<DraftModel[]>([]);
  const [defaultId, setDefaultId] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchModelSettings(), fetchModelPresets()])
      .then(([settingsRes, presetsRes]) => {
        if (cancelled) return;
        setPresets(
          presetsRes.presets.length > 0
            ? presetsRes.presets
            : DEFAULT_MODEL_PRESETS,
        );
        applyCatalog(
          settingsRes.catalog?.models?.length
            ? settingsRes.catalog
            : catalogFromSettings(settingsRes.settings),
        );
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPresets(DEFAULT_MODEL_PRESETS);
        applyCatalog(catalogFromSettings(DEFAULT_MODEL_SETTINGS));
        setError(
          err instanceof Error
            ? `${err.message} — showing defaults; fix the API connection then reload.`
            : "Failed to load settings — showing defaults",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyCatalog(catalog: ModelCatalogPublic) {
    const next = catalog.models.map(toDraft);
    setModels(next);
    setDefaultId(
      next.some((model) => model.id === catalog.defaultId)
        ? catalog.defaultId
        : (next[0]?.id ?? ""),
    );
    setEditor(null);
  }

  function starterPreset() {
    return presets.find((preset) => preset.id !== "custom") ?? presets[0];
  }

  function startAdd() {
    const preset = starterPreset();
    if (!preset) return;
    setError(null);
    setMessage(null);
    setEditor({
      mode: "add",
      draft: blankDraft(preset),
      makeDefault: models.length === 0,
    });
  }

  function startEdit(model: DraftModel) {
    setError(null);
    setMessage(null);
    setEditor({
      mode: "edit",
      draft: { ...model, apiKey: "" },
      makeDefault: model.id === defaultId,
    });
  }

  function patchDraft(partial: Partial<DraftModel>, markCustom = false) {
    setEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        draft: {
          ...current.draft,
          ...partial,
          ...(markCustom ? { presetId: "custom" } : {}),
        },
      };
    });
  }

  function onPresetChange(id: string) {
    const preset = presets.find((item) => item.id === id);
    if (!preset || id === "custom") {
      patchDraft({ presetId: id });
      return;
    }
    patchDraft({
      presetId: id,
      displayName: preset.displayName,
      baseURL: preset.baseURL,
      modelId: preset.modelId,
      contextWindowTokens: preset.contextWindowTokens,
    });
  }

  async function persist(
    list: DraftModel[],
    nextDefaultId: string,
    options?: { keepEditor?: boolean },
  ) {
    if (list.length === 0 || !list.some((model) => model.id === nextDefaultId)) {
      setError("Choose one saved model as the default.");
      setMessage(null);
      return;
    }

    const previousModels = models;
    const previousDefaultId = defaultId;
    const previousEditor = editor;

    setModels(list);
    setDefaultId(nextDefaultId);
    if (!options?.keepEditor) setEditor(null);
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const payload = {
        defaultId: nextDefaultId,
        models: list.map((model) => ({
          id: model.id,
          presetId: model.presetId,
          displayName: model.displayName,
          baseURL: model.baseURL,
          modelId: model.modelId,
          contextWindowTokens: model.contextWindowTokens,
          reasoning: model.reasoning,
          ...(model.apiKey.trim() ? { apiKey: model.apiKey.trim() } : {}),
        })),
      };
      const res = await saveModelCatalog(payload);
      const savedCatalog = resolveSavedCatalog(res, payload.models.length);
      const next = savedCatalog.models.map(toDraft);
      setModels(next);
      setDefaultId(
        next.some((model) => model.id === savedCatalog.defaultId)
          ? savedCatalog.defaultId
          : (next[0]?.id ?? ""),
      );
      if (!options?.keepEditor) setEditor(null);
      setMessage("Saved. New chats use the default model.");
    } catch (err) {
      setModels(previousModels);
      setDefaultId(previousDefaultId);
      setEditor(previousEditor);
      setMessage(null);
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  function onApplyEditor(e: FormEvent) {
    e.preventDefault();
    if (!editor || pending) return;
    const draft = editor.draft;
    if (!draft.displayName.trim() || !draft.baseURL.trim() || !draft.modelId.trim()) {
      setError("Display name, base URL, and model ID are required.");
      return;
    }
    if (!Number.isFinite(draft.contextWindowTokens) || draft.contextWindowTokens < 1024) {
      setError("Context window must be at least 1024 tokens.");
      return;
    }

    const previous = models.find((model) => model.id === draft.id);
    const nextModel: DraftModel = {
      ...draft,
      displayName: draft.displayName.trim(),
      baseURL: draft.baseURL.trim().replace(/\/$/, ""),
      modelId: draft.modelId.trim(),
      apiKey: draft.apiKey.trim() || previous?.apiKey || "",
    };
    const nextModels =
      editor.mode === "add"
        ? [...models, nextModel]
        : models.map((model) => (model.id === nextModel.id ? nextModel : model));
    const nextDefaultId =
      editor.makeDefault || models.length === 0 ? nextModel.id : defaultId;

    void persist(nextModels, nextDefaultId);
  }

  function removeModel(id: string) {
    if (models.length <= 1 || pending) return;
    const next = models.filter((model) => model.id !== id);
    const nextDefaultId = defaultId === id ? (next[0]?.id ?? "") : defaultId;
    void persist(next, nextDefaultId);
  }

  function chooseDefault(id: string) {
    if (id === defaultId || pending) return;
    void persist(models, id, { keepEditor: true });
  }

  if (loading) {
    return <p className="settings-muted">Loading model settings…</p>;
  }

  return (
    <div className="model-settings">
      <div className="model-form-intro">
        <h2>Model API</h2>
        <p>
          Add the OpenAI-compatible models you use. The one marked default is
          what new chats use, and each change saves immediately.
        </p>
      </div>

      <div className="model-toolbar">
        <span className="settings-muted">
          {models.length} saved {models.length === 1 ? "model" : "models"}
        </span>
        <button
          type="button"
          className="model-add"
          onClick={startAdd}
          disabled={pending || editor?.mode === "add"}
        >
          <Plus size={15} strokeWidth={2} />
          Add model
        </button>
      </div>

      <div className="model-table-wrap">
        <table className="model-table">
          <thead>
            <tr>
              <th>Default</th>
              <th>Name</th>
              <th>Model ID</th>
              <th>Base URL</th>
              <th>API key</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr
                key={model.id}
                className={model.id === defaultId ? "is-default" : undefined}
              >
                <td>
                  <input
                    type="radio"
                    name="model-default"
                    checked={model.id === defaultId}
                    disabled={pending}
                    onChange={() => chooseDefault(model.id)}
                    aria-label={`Use ${model.displayName} as the default`}
                  />
                </td>
                <td>
                  <div className="model-name">
                    <span>{model.displayName}</span>
                    {model.id === defaultId ? (
                      <span className="model-default-badge">Default</span>
                    ) : null}
                  </div>
                </td>
                <td className="model-mono">{model.modelId}</td>
                <td className="model-url" title={model.baseURL}>
                  {model.baseURL}
                </td>
                <td className="model-key">
                  {model.apiKey
                    ? "New key"
                    : model.hasApiKey
                      ? (model.apiKeyHint ?? "Saved")
                      : "Not set"}
                </td>
                <td>
                  <div className="model-row-actions">
                    <IconButton
                      icon={Pencil}
                      label={`Edit ${model.displayName}`}
                      size={16}
                      disabled={pending}
                      onClick={() => startEdit(model)}
                    />
                    <IconButton
                      icon={Trash2}
                      label={
                        models.length <= 1
                          ? "Keep at least one model"
                          : `Remove ${model.displayName}`
                      }
                      size={16}
                      className="danger"
                      disabled={pending || models.length <= 1}
                      onClick={() => removeModel(model.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editor ? (
        <form className="model-editor" onSubmit={onApplyEditor} autoComplete="off">
          <h3>{editor.mode === "add" ? "Add model" : "Edit model"}</h3>
          <div className="model-editor-grid">
            <label>
              Preset
              <select
                value={editor.draft.presetId}
                onChange={(e) => onPresetChange(e.target.value)}
                autoComplete="off"
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Display name
              <input
                value={editor.draft.displayName}
                onChange={(e) => patchDraft({ displayName: e.target.value })}
                placeholder="Shown in the chat composer"
                name="model-display-name"
                autoComplete="off"
                required
              />
            </label>

            <label className="wide">
              Base URL
              <input
                value={editor.draft.baseURL}
                onChange={(e) => patchDraft({ baseURL: e.target.value }, true)}
                placeholder="https://api.deepseek.com/v1"
                name="model-base-url"
                autoComplete="off"
                required
              />
            </label>

            <label>
              Model ID
              <input
                value={editor.draft.modelId}
                onChange={(e) => patchDraft({ modelId: e.target.value }, true)}
                placeholder="deepseek-flash"
                name="model-id"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                required
              />
            </label>

            <label>
              API key
              <input
                type="password"
                value={editor.draft.apiKey}
                onChange={(e) => patchDraft({ apiKey: e.target.value })}
                placeholder={
                  editor.mode === "edit" &&
                  (editor.draft.hasApiKey ||
                    models.find((model) => model.id === editor.draft.id)?.apiKey)
                    ? `Saved ${editor.draft.apiKeyHint ?? "••••"} — leave blank to keep`
                    : "sk-…"
                }
                name="model-api-key"
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
              />
            </label>

            <label>
              Context window
              <select
                value={editor.draft.contextWindowTokens}
                onChange={(e) =>
                  patchDraft(
                    { contextWindowTokens: Number(e.target.value) },
                    true,
                  )
                }
                name="model-context-window"
                autoComplete="off"
                required
              >
                {CONTEXT_WINDOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {!CONTEXT_WINDOW_OPTIONS.some(
                  (option) => option.value === editor.draft.contextWindowTokens,
                ) ? (
                  <option value={editor.draft.contextWindowTokens}>
                    {formatContextWindowLabel(editor.draft.contextWindowTokens)} (saved)
                  </option>
                ) : null}
              </select>
            </label>

            <label>
              Reasoning
              <select
                value={editor.draft.reasoning}
                onChange={(e) =>
                  patchDraft({ reasoning: e.target.value as ModelReasoning })
                }
                autoComplete="off"
              >
                {REASONING_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>

            <label className="model-check wide">
              <input
                type="checkbox"
                checked={editor.makeDefault}
                onChange={(e) =>
                  setEditor((current) =>
                    current ? { ...current, makeDefault: e.target.checked } : current,
                  )
                }
              />
              Use as the default model
            </label>
          </div>

          <div className="model-editor-actions">
            <button type="submit" disabled={pending}>
              {pending ? "Saving…" : editor.mode === "add" ? "Add" : "Save"}
            </button>
            <button
              type="button"
              className="model-cancel"
              onClick={() => setEditor(null)}
              disabled={pending}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="settings-error">{error}</p> : null}
      {message ? <p className="settings-ok">{message}</p> : null}
    </div>
  );
}
