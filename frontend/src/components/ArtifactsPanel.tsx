import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArtifactPreviewPanel } from "@fde/artifact-ui";
import type { ArtifactSpec } from "@fde/artifact-spec";
import { Boxes, Loader2, Search, X } from "lucide-react";
import { API_URL } from "../lib/config";
import { useAuth } from "../lib/auth";
import {
  fetchAgentArtifacts,
  fetchArtifactSpec,
  formatArtifactTimestamp,
  type AgentArtifactListItem,
} from "../lib/artifacts";
import { ResizableAside } from "./ResizableAside";
import "./ArtifactsPanel.css";

type Props = {
  agentId: string;
};

function matchesSearch(item: AgentArtifactListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.filename,
    item.title,
    item.chatTitle ?? "",
    item.artifactId,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function ArtifactsPanel({ agentId }: Props) {
  const { token } = useAuth();
  const [items, setItems] = useState<AgentArtifactListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [previewSpec, setPreviewSpec] = useState<ArtifactSpec | null>(null);
  const [previewChatId, setPreviewChatId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAgentArtifacts(agentId);
      setItems(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load artifacts");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  const filtered = useMemo(
    () => items.filter((item) => matchesSearch(item, searchQuery)),
    [items, searchQuery],
  );

  const previewOpen = previewKey !== null;

  const closePreview = useCallback(() => {
    setPreviewSpec(null);
    setPreviewChatId(null);
    setPreviewKey(null);
    setPreviewTitle(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }, []);

  async function openPreview(item: AgentArtifactListItem) {
    const key = `${item.chatId}:${item.artifactId}`;
    if (previewKey === key && previewSpec) {
      closePreview();
      return;
    }
    setPreviewKey(key);
    setPreviewChatId(item.chatId);
    setPreviewTitle(item.filename);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewSpec(null);
    try {
      const spec = await fetchArtifactSpec(item.chatId, item.artifactId);
      setPreviewSpec(spec);
    } catch (err: unknown) {
      setPreviewError(
        err instanceof Error ? err.message : "Could not open preview",
      );
      closePreview();
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="artifacts-panel">
      <div className="artifacts-panel-body">
        <section
          className={
            previewOpen
              ? "artifacts-list-column artifacts-list-column-narrow"
              : "artifacts-list-column"
          }
        >
          <header className="artifacts-list-header">
            <div className="artifacts-list-header-text">
              <h2 className="artifacts-panel-title">Artifacts</h2>
              <p className="artifacts-panel-subtitle">
                Published deliverables from your chats with this agent.
              </p>
            </div>
            <div className="artifacts-header-tools">
              {searchOpen ? (
                <div className="artifacts-search-wrap">
                  <input
                    ref={searchInputRef}
                    type="search"
                    className="artifacts-search-input"
                    placeholder="Search by filename…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search artifacts"
                  />
                </div>
              ) : null}
              <button
                type="button"
                className="artifacts-search-toggle"
                aria-label={searchOpen ? "Close search" : "Search artifacts"}
                aria-pressed={searchOpen}
                title={searchOpen ? "Close search" : "Search"}
                onClick={() => {
                  setSearchOpen((v) => {
                    if (v) setSearchQuery("");
                    return !v;
                  });
                }}
              >
                <Search size={18} strokeWidth={2} />
              </button>
            </div>
          </header>

          <div className="artifacts-list-body">
            {loading ? (
              <div className="artifacts-list-loading" role="status">
                <Loader2 size={22} className="spin" aria-hidden />
                <span>Loading artifacts…</span>
              </div>
            ) : (
              <>
                {error ? (
                  <p className="artifacts-error" role="alert">
                    {error}
                  </p>
                ) : null}
                {previewError ? (
                  <p className="artifacts-error" role="alert">
                    {previewError}
                  </p>
                ) : null}
                {!error && filtered.length === 0 ? (
                  <p className="artifacts-muted">
                    {items.length === 0
                      ? "No artifacts yet. Published deliverables from chats will appear here."
                      : "No artifacts match your search."}
                  </p>
                ) : null}
                <div className="artifacts-card-list">
                  {filtered.map((item) => {
                const key = `${item.chatId}:${item.artifactId}`;
                const active = previewKey === key;
                const subtitle = [item.chatTitle, item.artifactId]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <button
                    key={key}
                    type="button"
                    className={
                      active ? "artifacts-card active" : "artifacts-card"
                    }
                    onClick={() => void openPreview(item)}
                  >
                    <span className="artifacts-card-icon" aria-hidden>
                      <Boxes size={18} strokeWidth={2} />
                    </span>
                    <span className="artifacts-card-main">
                      <span className="artifacts-card-filename">
                        {item.filename}
                      </span>
                      {subtitle ? (
                        <span className="artifacts-card-meta">{subtitle}</span>
                      ) : null}
                    </span>
                    <span className="artifacts-card-time">
                      {formatArtifactTimestamp(item.updatedAt)}
                    </span>
              </button>
            );
          })}
                </div>
              </>
            )}
          </div>
        </section>

        {previewOpen ? (
          <ResizableAside
            defaultWidth={520}
            minWidth={320}
            className="artifacts-preview-aside"
            showHandleDivider
          >
            {previewLoading || !previewSpec ? (
              <aside className="artifacts-preview-shell">
                <div className="artifacts-preview-shell-header">
                  <strong>{previewTitle ?? "Preview"}</strong>
                  <button
                    type="button"
                    className="artifacts-preview-shell-close"
                    aria-label="Close preview"
                    onClick={closePreview}
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </div>
                <div className="artifacts-preview-shell-body">
                  <Loader2 size={20} className="spin" aria-hidden />
                  <span>Loading preview…</span>
                </div>
              </aside>
            ) : (
              <ArtifactPreviewPanel
                spec={previewSpec}
                apiBase={API_URL}
                token={token}
                chatId={previewChatId}
                open
                onClose={closePreview}
              />
            )}
          </ResizableAside>
        ) : null}
      </div>
    </div>
  );
}
