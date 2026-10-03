import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  fetchProject,
  fetchProjectWorkspaceFileIds,
  saveProjectWorkspaceFileIds,
  updateProject,
} from "../lib/projects";
import { lookupWorkspaceFiles, type WorkspaceFilePublic } from "../lib/workspace";
import { ComposerWorkspaceImportModal } from "./ComposerWorkspaceImportModal";
import { MarkdownContent } from "./MarkdownContent";
import { showToast } from "../hooks/useToast";
import "./ProjectEditor.css";

type Props = {
  projectId: string;
  agentId: string;
  onProjectUpdated?: () => void;
};

export function ProjectEditor({
  projectId,
  agentId,
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
  const [instructionsView, setInstructionsView] = useState<"edit" | "preview">(
    "edit",
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [project, ids] = await Promise.all([
        fetchProject(projectId, agentId),
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
  }, [projectId, agentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const contextIdSet = useMemo(() => new Set(contextIds), [contextIds]);

  async function handleSaveInstructions() {
    setSaving(true);
    setError(null);
    try {
      await updateProject(projectId, agentId, {
        name: name.trim() || undefined,
        instructions,
      });
      onProjectUpdated?.();
      showToast("success", "Project saved.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not save instructions";
      setError(message);
      showToast("error", message);
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
      showToast("success", "Project context saved.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not save project context";
      setError(message);
      showToast("error", message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveContext(fileId: string) {
    await persistContextIds(contextIds.filter((id) => id !== fileId));
  }

  if (loading) {
    return (
      <div className="project-editor-state" role="status">
        <Loader2 size={24} className="project-editor-spin" aria-hidden />
        <span>Loading project…</span>
      </div>
    );
  }

  return (
    <div className="project-editor">
      <div className="project-editor-toolbar">
        <label className="project-editor-name-field">
          <span className="project-editor-name-label">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void handleSaveInstructions()}
            disabled={saving}
          />
        </label>
        <div className="project-editor-tab-bar">
          <div className="page-tabs project-editor-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "instructions"}
              className={tab === "instructions" ? "page-tab active" : "page-tab"}
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
          {tab === "instructions" ? (
            <div
              className="project-editor-instructions-mode"
              role="tablist"
              aria-label="Instructions view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={instructionsView === "edit"}
                className={
                  instructionsView === "edit"
                    ? "project-editor-mode-tab active"
                    : "project-editor-mode-tab"
                }
                onClick={() => setInstructionsView("edit")}
              >
                Edit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={instructionsView === "preview"}
                className={
                  instructionsView === "preview"
                    ? "project-editor-mode-tab active"
                    : "project-editor-mode-tab"
                }
                onClick={() => setInstructionsView("preview")}
              >
                Preview
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="project-editor-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="project-editor-workspace">
        {tab === "instructions" ? (
          <>
            <div className="project-editor-pane">
              {instructionsView === "edit" ? (
                <label className="project-editor-instructions">
                  <span className="sr-only">Project instructions</span>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Standing instructions for this project…"
                    disabled={saving}
                  />
                </label>
              ) : (
                <div className="project-editor-instructions-preview">
                  {instructions.trim() ? (
                    <MarkdownContent text={instructions} />
                  ) : (
                    <p className="project-editor-preview-empty">
                      No instructions yet. Switch to Edit to add project rules.
                    </p>
                  )}
                </div>
              )}
            </div>
            {instructionsView === "edit" ? (
              <footer className="project-editor-footer">
                <button
                  type="button"
                  className="project-editor-save"
                  disabled={saving}
                  onClick={() => void handleSaveInstructions()}
                >
                  {saving ? "Saving…" : "Save instructions"}
                </button>
              </footer>
            ) : null}
          </>
        ) : (
          <div className="project-editor-pane project-editor-pane--context">
            <p className="project-editor-context-hint">
              Imported workspace files stay attached to this project across
              chats.
            </p>
            <button
              type="button"
              className="project-editor-save project-editor-import-btn"
              disabled={saving}
              onClick={() => setImportOpen(true)}
            >
              <Plus size={16} strokeWidth={2} aria-hidden />
              Import from workspace
            </button>
            <ul className="project-editor-context-list">
              {contextFiles.length === 0 ? (
                <li className="project-editor-context-empty">
                  No workspace files in project context yet.
                </li>
              ) : (
                contextFiles.map((file) => (
                  <li key={file.id} className="project-editor-context-row">
                    <span className="project-editor-context-name">
                      {file.filename}
                    </span>
                    <button
                      type="button"
                      className="project-editor-context-remove"
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
    </div>
  );
}
