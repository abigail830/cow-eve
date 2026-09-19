import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, Cpu, SlidersHorizontal } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import {
  fetchModelPresets,
  fetchModelSettings,
  saveModelSettings,
  type ModelPreset,
  type ModelReasoning,
  type ModelSettingsPublic,
} from "../lib/api";
import {
  DEFAULT_MODEL_PRESETS,
  DEFAULT_MODEL_SETTINGS,
} from "../lib/model-defaults";
import { useAuth } from "../lib/auth";
import "./Settings.css";

type TabId = "model" | "general";

const REASONING_OPTIONS: ModelReasoning[] = [
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

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
            className={tab === "general" ? "active" : ""}
            onClick={() => setTab("general")}
          >
            <SlidersHorizontal size={16} strokeWidth={2} />
            General
          </button>
        </nav>

        <div className="settings-panel">
          {tab === "model" ? <ModelSettingsTab /> : <GeneralPlaceholder />}
        </div>
      </div>
    </div>
  );
}

function GeneralPlaceholder() {
  return (
    <div className="settings-placeholder">
      <h2>General</h2>
      <p>More platform settings will land here in later milestones.</p>
    </div>
  );
}

function ModelSettingsTab() {
  const [presets, setPresets] = useState<ModelPreset[]>(DEFAULT_MODEL_PRESETS);
  const [settings, setSettings] = useState<ModelSettingsPublic | null>(null);
  const [presetId, setPresetId] = useState(DEFAULT_MODEL_SETTINGS.presetId);
  const [displayName, setDisplayName] = useState(
    DEFAULT_MODEL_SETTINGS.displayName,
  );
  const [baseURL, setBaseURL] = useState(DEFAULT_MODEL_SETTINGS.baseURL);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_SETTINGS.modelId);
  const [contextWindowTokens, setContextWindowTokens] = useState(
    DEFAULT_MODEL_SETTINGS.contextWindowTokens,
  );
  const [reasoning, setReasoning] = useState<ModelReasoning>(
    DEFAULT_MODEL_SETTINGS.reasoning,
  );
  const [apiKey, setApiKey] = useState("");
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
        applySettings(settingsRes.settings);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Keep usable defaults so the form is not empty for browser autofill.
        setPresets(DEFAULT_MODEL_PRESETS);
        applySettings(DEFAULT_MODEL_SETTINGS);
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

  function applySettings(s: ModelSettingsPublic) {
    setSettings(s);
    setPresetId(s.presetId || "deepseek");
    setDisplayName(s.displayName);
    setBaseURL(s.baseURL);
    setModelId(s.modelId);
    setContextWindowTokens(s.contextWindowTokens);
    setReasoning(s.reasoning);
    setApiKey("");
  }

  function onPresetChange(id: string) {
    setPresetId(id);
    const preset = presets.find((p) => p.id === id);
    if (!preset || id === "custom") return;
    setDisplayName(preset.displayName);
    setBaseURL(preset.baseURL);
    setModelId(preset.modelId);
    setContextWindowTokens(preset.contextWindowTokens);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const res = await saveModelSettings({
        presetId,
        displayName,
        baseURL,
        modelId,
        contextWindowTokens,
        reasoning,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      applySettings(res.settings);
      setMessage("Saved. New chats will use this OpenAI-compatible endpoint.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="settings-muted">Loading model settings…</p>;
  }

  return (
    <form
      className="model-form"
      onSubmit={onSubmit}
      autoComplete="off"
    >
      <div className="model-form-intro">
        <h2>Model API</h2>
        <p>
          Connect DeepSeek, Qwen, or any OpenAI-compatible endpoint. The platform
          does not use Vercel AI Gateway.
        </p>
      </div>

      <label>
        Preset
        <select
          value={presetId}
          onChange={(e) => onPresetChange(e.target.value)}
          autoComplete="off"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Display name
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Shown in the chat composer"
          name="model-display-name"
          autoComplete="off"
          required
        />
      </label>

      <label>
        Base URL
        <input
          value={baseURL}
          onChange={(e) => {
            setPresetId("custom");
            setBaseURL(e.target.value);
          }}
          placeholder="https://api.deepseek.com/v1"
          name="model-base-url"
          autoComplete="off"
          required
        />
      </label>

      <label>
        Model ID
        <input
          value={modelId}
          onChange={(e) => {
            setPresetId("custom");
            setModelId(e.target.value);
          }}
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
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            settings?.hasApiKey
              ? `Saved ${settings.apiKeyHint ?? "••••"} — leave blank to keep`
              : "sk-…"
          }
          name="model-api-key"
          autoComplete="new-password"
          data-1p-ignore
          data-lpignore="true"
        />
      </label>

      <div className="model-form-row">
        <label>
          Context window (tokens)
          <input
            type="number"
            min={1024}
            step={1024}
            value={contextWindowTokens}
            onChange={(e) => setContextWindowTokens(Number(e.target.value))}
            name="model-context-window"
            autoComplete="off"
            required
          />
        </label>

        <label>
          Reasoning
          <select
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value as ModelReasoning)}
            autoComplete="off"
          >
            {REASONING_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="settings-error">{error}</p> : null}
      {message ? <p className="settings-ok">{message}</p> : null}

      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save model settings"}
      </button>
    </form>
  );
}
