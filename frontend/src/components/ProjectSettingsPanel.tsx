import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import {
  fetchProject,
  fetchProjectWorkspaceFileIds,
  saveProjectWorkspaceFileIds,
  updateProject,
} from "../lib/projects";
import { lookupWorkspaceFiles, type WorkspaceFilePublic } from "../lib/workspace";
import { ComposerWorkspaceImportModal } from "./ComposerWorkspaceImportModal";
import "./ProjectSettingsPanel.css";

type Props = {
  projectId: string;
  onClose: () => void;
  onProjectUpdated?: () => void;
};

export function ProjectSettingsPanel({
  projectId,
  onClose,
  onProjectUpdated,
}: Props) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [contextFiles, setContextFiles] = useState<WorkspaceFilePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState<"instructions" | "context">("instructions");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [project, ids] = await Promise.all([
        fetchProject(projectId),
        fetchProjectWorkspaceFileIds(projectId),
      ]);
      setName(project.name);
      setInstructions(project.instructions);
      setContextIds(ids);
      if (ids.length === 0) {
        setContextFiles([]);
      } else {
        setContextFiles(await lookupWorkspaceFiles(ids));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const contextIdSet = useMemo(() => new Set(contextIds), [contextIds]);

  async function handleSaveInstructions() {
    setSaving(true);
    setError(null);
    try {
      await updateProject(projectId, {
        name: name.trim() || undefined,
        instructions,
      });
      onProjectUpdated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function persistContextIds(nextIds: string[]) {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveProjectWorkspaceFileIds(projectId, nextIds);
      setContextIds(saved);
      setContextFiles(
        saved.length === 0 ? [] : await lookupWorkspaceFiles(saved),
      );
      onProjectUpdated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save context");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveContext(fileId: string) {
    await persistContextIds(contextIds.filter((id) => id !== fileId));
  }

  return (
    <aside className="project-settings-panel">
      <header className="project-settings-header">
        <h3>Project settings</h3>
        <button
          type="button"
          className="project-settings-close"
          aria-label="Close project settings"
          onClick={onClose}
        >
          <X size={18} strokeWidth={2} />
        </button>
      </header>

      {loading ? (
        <div className="project-settings-state" role="status">
          <Loader2 size={20} className="project-settings-spin" aria-hidden />
          <span>Loading…</span>
        </div>
      ) : (
        <div className="project-settings-body">
          <label className="project-settings-name-field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void handleSaveInstructions()}
              disabled={saving}
            />
          </label>

          <div className="page-tabs project-settings-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "instructions"}
              className={
                tab === "instructions" ? "page-tab active" : "page-tab"
              }
              onClick={() => setTab("instructions")}
            >
              Instructions
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "context"}
              className={tab === "context" ? "page-tab active" : "page-tab"}
              onClick={() => setTab("context")}
            >
              Context
            </button>
          </div>

          {error ? (
            <p className="project-settings-error" role="alert">
              {error}
            </p>
          ) : null}

          {tab === "instructions" ? (
            <div className="project-settings-section">
              <label className="project-settings-instructions">
                <span className="sr-only">Project instructions</span>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={12}
                  placeholder="Standing instructions for this project…"
                  disabled={saving}
                />
              </label>
              <button
                type="button"
                className="project-settings-save"
                disabled={saving}
                onClick={() => void handleSaveInstructions()}
              >
                {saving ? "Saving…" : "Save instructions"}
              </button>
            </div>
          ) : (
            <div className="project-settings-section">
              <p className="project-settings-context-hint">
                Imported workspace files stay attached to this project across
                chats.
              </p>
              <button
                type="button"
                className="project-settings-import-btn"
                disabled={saving}
                onClick={() => setImportOpen(true)}
              >
                <Plus size={16} strokeWidth={2} aria-hidden />
                Import from workspace
              </button>
              <ul className="project-settings-context-list">
                {contextFiles.length === 0 ? (
                  <li className="project-settings-context-empty">
                    No workspace files in project context yet.
                  </li>
                ) : (
                  contextFiles.map((file) => (
                    <li key={file.id} className="project-settings-context-row">
                      <span className="project-settings-context-name">
                        {file.filename}
                      </span>
                      <button
                        type="button"
                        className="project-settings-context-remove"
                        aria-label={`Remove ${file.filename} from project context`}
                        disabled={saving}
                        onClick={() => void handleRemoveContext(file.id)}
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      <ComposerWorkspaceImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        alreadyImportedIds={contextIdSet}
        onImport={(files) => {
          setImportOpen(false);
          const merged = [...contextIds];
          for (const f of files) {
            if (!merged.includes(f.id)) merged.push(f.id);
          }
          void persistContextIds(merged);
        }}
      />
    </aside>
  );
}
