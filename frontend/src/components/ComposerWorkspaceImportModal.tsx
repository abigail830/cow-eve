import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  effectiveParseStatus,
  isAttachmentReadyForSend,
} from "../lib/attachmentParseProgress";
import { workspaceFileAsAttachmentRow } from "../lib/workspaceParse";
import {
  fetchWorkspaceFiles,
  fetchWorkspaceFolders,
  type WorkspaceFilePublic,
  type WorkspaceFolderPublic,
} from "../lib/workspace";
import "./ComposerWorkspaceImportModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (files: readonly WorkspaceFilePublic[]) => void;
  alreadyImportedIds: ReadonlySet<string>;
};

export function ComposerWorkspaceImportModal({
  open,
  onClose,
  onImport,
  alreadyImportedIds,
}: Props) {
  const [folders, setFolders] = useState<WorkspaceFolderPublic[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [files, setFiles] = useState<WorkspaceFilePublic[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    void fetchWorkspaceFolders()
      .then((list) => {
        setFolders(list);
        setFolderId((prev) => prev ?? list[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load folders");
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || !folderId) {
      setFiles([]);
      return;
    }
    setLoading(true);
    void fetchWorkspaceFiles(folderId)
      .then(setFiles)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load files");
        setFiles([]);
      })
      .finally(() => setLoading(false));
  }, [folderId, open]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
    }
  }, [open]);

  if (!open) return null;

  function toggleFile(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    const picked = files.filter((f) => selected.has(f.id));
    if (picked.length === 0) return;
    onImport(picked);
    onClose();
  }

  return (
    <div className="workspace-import-backdrop" role="presentation" onClick={onClose}>
      <div
        className="workspace-import-dialog"
        role="dialog"
        aria-labelledby="workspace-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="workspace-import-header">
          <h2 id="workspace-import-title">Import from Workspace</h2>
          <button
            type="button"
            className="workspace-import-close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        {error ? (
          <p className="workspace-import-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="workspace-import-toolbar">
          <label className="workspace-import-label">
            Folder
            <select
              value={folderId ?? ""}
              onChange={(e) => setFolderId(e.target.value || null)}
              disabled={folders.length === 0}
            >
              {folders.length === 0 ? (
                <option value="">No folders</option>
              ) : (
                folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <div className="workspace-import-list">
          {loading ? (
            <p className="workspace-import-muted">
              <Loader2 size={14} className="spin" aria-hidden /> Loading…
            </p>
          ) : files.length === 0 ? (
            <p className="workspace-import-muted">No files in this folder.</p>
          ) : (
            files.map((file) => {
              const row = workspaceFileAsAttachmentRow(file);
              const ready = isAttachmentReadyForSend(row);
              const status = effectiveParseStatus(row);
              const disabled =
                !ready || alreadyImportedIds.has(file.id);
              return (
                <label
                  key={file.id}
                  className={
                    disabled
                      ? "workspace-import-row disabled"
                      : "workspace-import-row"
                  }
                >
                  <input
                    type="checkbox"
                    checked={selected.has(file.id)}
                    disabled={disabled}
                    onChange={() => toggleFile(file.id)}
                  />
                  <span className="workspace-import-row-text">
                    <span>{file.filename}</span>
                    <span className="workspace-import-badge">
                      {alreadyImportedIds.has(file.id)
                        ? "Already in composer"
                        : status}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        <footer className="workspace-import-footer">
          <button type="button" className="workspace-import-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="workspace-import-btn primary"
            disabled={selected.size === 0}
            onClick={handleConfirm}
          >
            Add to message
          </button>
        </footer>
      </div>
    </div>
  );
}
