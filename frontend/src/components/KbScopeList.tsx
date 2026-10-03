import type { KnowledgeBaseItem } from "../lib/knowledgeBases";

type Props = {
  loading: boolean;
  saving: boolean;
  error: string | null;
  connected: boolean;
  message: string | null;
  items: KnowledgeBaseItem[];
  onToggle: (id: string, enabled: boolean) => void;
  onSetAll: (enabled: boolean) => void;
  /** Compact styling for composer popover. */
  variant?: "popover" | "inline";
  /** When false, omit the built-in "Knowledge bases" title row (parent supplies section heading). */
  showHeader?: boolean;
};

function formatKbMeta(item: KnowledgeBaseItem): string | null {
  const parts = [
    item.type,
    typeof item.itemCount === "number" ? `${item.itemCount} docs` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function KbScopeList({
  loading,
  saving,
  error,
  connected,
  message,
  items,
  onToggle,
  onSetAll,
  variant = "inline",
  showHeader = true,
}: Props) {
  const rootClass =
    variant === "popover" ? "kb-scope-popover-body" : "kb-scope-inline";

  return (
    <div className={rootClass}>
      {showHeader ? (
        <div className="kb-scope-header">
          <div className="kb-scope-title">Knowledge bases</div>
          {connected && items.length > 0 ? (
            <div className="kb-scope-actions">
              <button type="button" onClick={() => onSetAll(true)} disabled={loading}>
                All on
              </button>
              <button type="button" onClick={() => onSetAll(false)} disabled={loading}>
                All off
              </button>
            </div>
          ) : null}
        </div>
      ) : connected && items.length > 0 ? (
        <div className="kb-scope-header kb-scope-header--actions-only">
          <div className="kb-scope-actions">
            <button type="button" onClick={() => onSetAll(true)} disabled={loading}>
              All on
            </button>
            <button type="button" onClick={() => onSetAll(false)} disabled={loading}>
              All off
            </button>
          </div>
        </div>
      ) : null}
      {loading && items.length === 0 ? (
        <p className="kb-scope-status">Loading…</p>
      ) : null}
      {!loading && error ? (
        <p className="kb-scope-error" role="alert">
          {error}
        </p>
      ) : null}
      {!error && !connected && !(loading && items.length === 0) ? (
        <p className="kb-scope-status">
          {message ||
            "Connect Hybrid Search in Integrations to list knowledge bases."}
        </p>
      ) : null}
      {!error && connected && items.length === 0 && !loading ? (
        <p className="kb-scope-status">
          {message || "No knowledge bases visible for this key."}
        </p>
      ) : null}
      {connected && items.length > 0 ? (
        <ul className="kb-scope-list">
          {items.map((item) => {
            const meta = formatKbMeta(item);
            return (
              <li key={item.id}>
                <label className="kb-scope-item">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(event) =>
                      onToggle(item.id, event.target.checked)
                    }
                  />
                  <span className="kb-scope-item-text">
                    <span className="kb-scope-item-name">{item.name}</span>
                    {meta ? (
                      <span className="kb-scope-item-meta">{meta}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
      {saving ? (
        <p className="kb-scope-status kb-scope-saving">Saving…</p>
      ) : null}
    </div>
  );
}
