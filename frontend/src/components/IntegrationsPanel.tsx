import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ExternalLink,
  Link2,
  Loader2,
  Plug,
  Settings2,
  Unplug,
  X,
} from "lucide-react";
import {
  connectIntegrationOAuth,
  disconnectIntegrationOAuth,
  fetchIntegrations,
  saveIntegration,
  type IntegrationCatalogItem,
  type IntegrationFieldPublic,
} from "../lib/integrations";
import "./IntegrationsPanel.css";

type Props = {
  agentId: string;
  /** Hide the page title when this list sits under the Customize tabs. */
  embedded?: boolean;
};

function configFieldDisplayValue(
  config: Record<string, string>,
  field: IntegrationFieldPublic,
  integrationConfigured: boolean,
): string {
  const stored = config[field.key]?.trim();
  if (stored) return stored;
  if (integrationConfigured) return "";
  return field.defaultValue ?? "";
}

function FieldInput({
  field,
  value,
  onChange,
  hint,
}: {
  field: IntegrationFieldPublic;
  value: string;
  onChange: (value: string) => void;
  hint: string | null;
}) {
  const isSecret = field.kind === "secret";
  return (
    <label className="integration-field">
      <span className="integration-field-label">
        {field.label}
        {field.required ? (
          <span className="integration-required" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      {field.description ? (
        <span className="integration-field-desc">{field.description}</span>
      ) : null}
      <input
        type={isSecret ? "password" : field.kind === "url" ? "url" : "text"}
        className="integration-field-input"
        placeholder={
          isSecret && hint
            ? `Saved (${hint}) — enter to replace`
            : field.placeholder
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={isSecret ? "off" : undefined}
      />
    </label>
  );
}

function IntegrationCardIcon() {
  return (
    <span className="integration-card-icon" aria-hidden>
      <Plug size={20} strokeWidth={1.75} />
    </span>
  );
}

function IntegrationStatus({ connected }: { connected: boolean }) {
  return (
    <span
      className={
        connected
          ? "integration-status integration-status-on"
          : "integration-status integration-status-off"
      }
    >
      <span className="integration-status-dot" aria-hidden />
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function IntegrationIconButton({
  label,
  onClick,
  disabled,
  variant = "ghost",
  ariaExpanded,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "ghost" | "primary";
  ariaExpanded?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`integration-card-cta integration-card-cta-icon integration-card-cta-${variant}`}
      aria-label={label}
      title={label}
      aria-expanded={ariaExpanded}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function OAuthIntegrationCard({
  item,
  agentId,
  onReload,
}: {
  item: IntegrationCatalogItem;
  agentId: string;
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await connectIntegrationOAuth(item.id, agentId);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start OAuth.");
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnectIntegrationOAuth(item.id, agentId);
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  };

  const showActions = item.platformConfigured;

  return (
    <article className="integration-card">
      <div className="integration-card-inner">
        <IntegrationCardIcon />
        <div className="integration-card-main">
          <div className="integration-card-head">
            <h3 className="integration-card-name">{item.name}</h3>
            {showActions ? (
              <div className="integration-card-head-actions">
                {item.connected ? (
                  <IntegrationIconButton
                    label={busy ? "Disconnecting…" : "Disconnect"}
                    disabled={busy}
                    onClick={() => void handleDisconnect()}
                  >
                    {busy ? (
                      <Loader2 size={16} className="integrations-spin" aria-hidden />
                    ) : (
                      <Unplug size={16} strokeWidth={2} aria-hidden />
                    )}
                  </IntegrationIconButton>
                ) : (
                  <IntegrationIconButton
                    label={busy ? "Connecting…" : "Connect"}
                    variant="primary"
                    disabled={busy}
                    onClick={() => void handleConnect()}
                  >
                    {busy ? (
                      <Loader2 size={16} className="integrations-spin" aria-hidden />
                    ) : (
                      <Link2 size={16} strokeWidth={2} aria-hidden />
                    )}
                  </IntegrationIconButton>
                )}
              </div>
            ) : null}
          </div>
          {!item.platformConfigured ? (
            <p className="integration-card-desc integration-card-desc-muted">
              Not available on this deployment.
            </p>
          ) : (
            <p className="integration-card-desc">{item.description}</p>
          )}
          {item.connected && item.accountLabel ? (
            <p className="integration-card-meta">{item.accountLabel}</p>
          ) : null}
          {error ? (
            <p className="integration-inline-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <footer className="integration-card-footer">
        <IntegrationStatus connected={item.connected && item.platformConfigured} />
        <a
          className="integration-doc-link"
          href={item.docUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs
          <ExternalLink size={12} strokeWidth={2} aria-hidden />
        </a>
      </footer>
    </article>
  );
}

function ApiKeyIntegrationCard({
  item,
  agentId,
  onSaved,
}: {
  item: IntegrationCatalogItem;
  agentId: string;
  onSaved: (next: IntegrationCatalogItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<Record<string, string>>({
    ...item.config,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig({ ...item.config });
    setSecrets({});
    setSaved(false);
    setError(null);
  }, [item.id, item.updatedAt]);

  const resetDraft = () => {
    setConfig({ ...item.config });
    setSecrets({});
    setError(null);
    setSaved(false);
  };

  const openSetup = () => {
    resetDraft();
    setExpanded(true);
  };

  const closeSetup = () => {
    resetDraft();
    setExpanded(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const secretPayload: Record<string, string | undefined> = {};
      for (const field of item.fields) {
        if (field.kind !== "secret") continue;
        const v = secrets[field.key]?.trim();
        if (v) secretPayload[field.key] = v;
      }
      const configPayload: Record<string, string | undefined> = {};
      for (const field of item.fields) {
        if (!field.storeInConfig) continue;
        let next = configFieldDisplayValue(config, field, item.configured).trim();
        if (
          !item.configured &&
          field.defaultValue &&
          next === field.defaultValue.trim()
        ) {
          next = "";
        }
        configPayload[field.key] = next;
      }
      const next = await saveIntegration(item.id, agentId, {
        secrets: secretPayload,
        config: configPayload,
      });
      onSaved(next);
      setSecrets({});
      setSaved(true);
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const manageLabel = item.configured ? "Manage" : "Connect";

  return (
    <article
      className={
        expanded ? "integration-card integration-card-expanded" : "integration-card"
      }
    >
      <div className="integration-card-inner">
        <IntegrationCardIcon />
        <div className="integration-card-main">
          <div className="integration-card-head">
            <h3 className="integration-card-name">{item.name}</h3>
            <div className="integration-card-head-actions">
              {expanded ? (
                <IntegrationIconButton
                  label={saving ? "Saving…" : "Save"}
                  variant="primary"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? (
                    <Loader2 size={16} className="integrations-spin" aria-hidden />
                  ) : (
                    <Check size={16} strokeWidth={2.25} aria-hidden />
                  )}
                </IntegrationIconButton>
              ) : null}
              <IntegrationIconButton
                label={expanded ? "Close" : manageLabel}
                variant={expanded || item.configured ? "ghost" : "primary"}
                ariaExpanded={expanded}
                onClick={() => (expanded ? closeSetup() : openSetup())}
              >
                {expanded ? (
                  <X size={16} strokeWidth={2.25} aria-hidden />
                ) : item.configured ? (
                  <Settings2 size={16} strokeWidth={2} aria-hidden />
                ) : (
                  <Link2 size={16} strokeWidth={2} aria-hidden />
                )}
              </IntegrationIconButton>
            </div>
          </div>
          <p className="integration-card-desc">{item.description}</p>
        </div>
      </div>
      {!expanded ? (
        <footer className="integration-card-footer">
          <IntegrationStatus connected={item.configured} />
          <a
            className="integration-doc-link"
            href={item.docUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Docs
            <ExternalLink size={12} strokeWidth={2} aria-hidden />
          </a>
        </footer>
      ) : null}

      {expanded ? (
        <div className="integration-card-setup">
          <a
            className="integration-doc-link"
            href={item.docUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
            <ExternalLink size={13} strokeWidth={2} aria-hidden />
          </a>
          <div className="integration-fields">
            {item.fields.map((field) =>
              field.kind === "secret" ? (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={secrets[field.key] ?? ""}
                  hint={item.secretHints[field.key] ?? null}
                  onChange={(v) =>
                    setSecrets((prev) => ({ ...prev, [field.key]: v }))
                  }
                />
              ) : field.storeInConfig ? (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={configFieldDisplayValue(
                    config,
                    field,
                    item.configured,
                  )}
                  hint={null}
                  onChange={(v) =>
                    setConfig((prev) => ({ ...prev, [field.key]: v }))
                  }
                />
              ) : null,
            )}
          </div>
          {error ? (
            <p className="integration-inline-error" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="integration-inline-saved" role="status">
              Saved. New chat sessions will use these credentials.
            </p>
          ) : null}
          <div className="integration-setup-actions">
            <button
              type="button"
              className="integration-action-btn integration-action-btn-ghost"
              disabled={saving}
              onClick={closeSetup}
            >
              Cancel
            </button>
            <button
              type="button"
              className="integration-action-btn integration-action-btn-primary"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function IntegrationsPanel({ agentId, embedded = false }: Props) {
  const [items, setItems] = useState<IntegrationCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [oauthToast, setOauthToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchIntegrations(agentId);
      setItems(list);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load integrations.",
      );
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("integrations") !== "1") return;
    const status = params.get("status");
    const provider = params.get("provider");
    const oauthError = params.get("error");
    if (status === "connected" && provider) {
      setOauthToast(`${provider} connected successfully.`);
      void reload();
    } else if (status === "error") {
      setOauthToast(oauthError ?? "Integration connect failed.");
    }
    params.delete("integrations");
    params.delete("provider");
    params.delete("status");
    params.delete("error");
    params.delete("agentId");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [reload]);

  const handleSaved = (next: IntegrationCatalogItem) => {
    setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)));
  };

  return (
    <div className="integrations-panel">
      <div className="integrations-panel-body">
        <section className="integrations-list-column">
          {embedded ? null : (
            <header className="integrations-list-header">
              <h2 className="page-title">Integrations</h2>
            </header>
          )}
          <div className="integrations-list-body">
            {loading ? (
              <div className="integrations-state-center" role="status">
                <Loader2 size={22} className="integrations-spin" aria-hidden />
                <span>Loading integrations…</span>
              </div>
            ) : error ? (
              <div className="integrations-state-center">
                <p className="integrations-error" role="alert">
                  {error}
                </p>
              </div>
            ) : items.length === 0 ? (
              <div className="integrations-state-center">
                <p className="integrations-muted">
                  No integrations available yet.
                </p>
              </div>
            ) : (
              <div className="integrations-list">
                {oauthToast ? (
                  <p className="integration-inline-saved" role="status">
                    {oauthToast}
                  </p>
                ) : null}
                {items.map((item) =>
                  item.authKind === "oauth" ? (
                    <OAuthIntegrationCard
                      key={item.id}
                      item={item}
                      agentId={agentId}
                      onReload={reload}
                    />
                  ) : (
                    <ApiKeyIntegrationCard
                      key={item.id}
                      item={item}
                      agentId={agentId}
                      onSaved={handleSaved}
                    />
                  ),
                )}
              </div>
            )}
          </div>
          <p className="integrations-account-note">
            User-scoped integrations (API keys) apply to every agent. OAuth
            integrations (Notion, HubSpot, Feishu) are configured per agent.
          </p>
        </section>
      </div>
    </div>
  );
}
