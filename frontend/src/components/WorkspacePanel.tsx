import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  DocumentPreviewPanel,
  type DocumentPreviewBundle,
} from "@fde/artifact-ui";
import { FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { formatBytes } from "../lib/attachments";
import { useAuth } from "../lib/auth";
import {
  ATTACHMENT_PARSE_POLL_MS,
  attachmentNeedsParsePoll,
  effectiveParseStatus,
  parseStatusLabel,
} from "../lib/attachmentParseProgress";
import { workspaceFileAsAttachmentRow } from "../lib/workspaceParse";
import {
  deleteWorkspaceFile,
  fetchWorkspaceFilePreviewBundle,
  fetchWorkspaceFiles,
  uploadWorkspaceFile,
  workspaceFileDownloadUrl,
  workspaceFileFigureUrl,
  type WorkspaceFilePublic,
  type WorkspaceFolderPublic,
} from "../lib/workspace";
import { ResizableAside } from "./ResizableAside";
import "./WorkspacePanel.css";

type Props = {
  folders: readonly WorkspaceFolderPublic[];
  selectedFolderId: string | null;
};

export function WorkspacePanel({
  folders,
  selectedFolderId,
}: Props) {
  const { token } = useAuth();
  const [files, setFiles] = useState<WorkspaceFilePublic[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewBundle, setPreviewBundle] = useState<DocumentPreviewBundle | null>(
    null,
  );
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );

  const previewOpen = Boolean(previewTitle);

  const reloadFiles = useCallback(async () => {
    if (!selectedFolderId) {
      setFiles([]);
      return;
    }
    setLoadingFiles(true);
    setError(null);
    try {
      const next = await fetchWorkspaceFiles(selectedFolderId);
      setFiles(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load files");
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, [selectedFolderId]);

  useEffect(() => {
    void reloadFiles();
  }, [reloadFiles]);

  const parseRows = useMemo(
    () => files.map((f) => workspaceFileAsAttachmentRow(f)),
    [files],
  );

  const shouldPoll = useMemo(
    () => attachmentNeedsParsePoll(parseRows),
    [parseRows],
  );

  useEffect(() => {
    if (!shouldPoll || !selectedFolderId) return;
    const timer = window.setInterval(() => {
      void fetchWorkspaceFiles(selectedFolderId)
        .then(setFiles)
        .catch(() => undefined);
    }, ATTACHMENT_PARSE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [selectedFolderId, shouldPoll]);

  async function handleUpload(list: FileList | null) {
    if (!list?.length || !selectedFolderId) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(list)) {
        await uploadWorkspaceFile(selectedFolderId, file);
      }
      await reloadFiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteFile(file: WorkspaceFilePublic) {
    if (!window.confirm(`Delete "${file.filename}"?`)) return;
    setError(null);
    try {
      await deleteWorkspaceFile(file.id);
      if (previewFileId === file.id) {
        closePreview();
      }
      await reloadFiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const closePreview = useCallback(() => {
    setPreviewBundle(null);
    setPreviewTitle(null);
    setPreviewFileId(null);
  }, []);

  const resolvePreviewFigureUrl = useCallback(
    (figureRef: string) => {
      if (!previewFileId) return "";
      return workspaceFileFigureUrl(previewFileId, figureRef);
    },
    [previewFileId],
  );

  async function openPreview(file: WorkspaceFilePublic) {
    setPreviewLoading(true);
    setPreviewTitle(file.filename);
    setPreviewFileId(file.id);
    setPreviewBundle(null);
    try {
      const bundle = await fetchWorkspaceFilePreviewBundle(file.id);
      setPreviewBundle(bundle);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Preview not available");
      closePreview();
    } finally {
      setPreviewLoading(false);
    }
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    void handleUpload(e.target.files);
  }

  const listHeader = (
    <header className="workspace-list-header">
      <h2 className="page-title workspace-panel-title">
        {selectedFolder ? (
          <>
            <span className="workspace-panel-title-root">Workspace</span>
            <span className="workspace-panel-title-sep" aria-hidden>
              |
            </span>
            <span className="workspace-panel-title-folder">
              {selectedFolder.name}
            </span>
          </>
        ) : (
          "Workspace"
        )}
      </h2>
      {selectedFolderId ? (
        <div className="workspace-toolbar">
          <div className="workspace-panel-actions">
            <input
              ref={fileInputRef}
              type="file"
              className="workspace-file-input"
              multiple
              onChange={onFileInputChange}
            />
            <button
              type="button"
              className="workspace-btn primary"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 size={16} className="spin" aria-hidden />
              ) : (
                <Upload size={16} strokeWidth={2} aria-hidden />
              )}
              Upload
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );

  return (
    <div className="workspace-panel">
      <div className="workspace-panel-body">
        <section
          className={
            previewOpen
              ? "workspace-list-column workspace-list-column-narrow"
              : "workspace-list-column"
          }
        >
          {listHeader}
          {error ? (
            <p className="workspace-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="workspace-file-list">
            {loadingFiles ? (
              <div className="workspace-state-center" role="status">
                <Loader2 size={22} className="spin" aria-hidden />
                <span>Loading files…</span>
              </div>
            ) : !selectedFolderId ? (
              <div className="workspace-state-center">
                <p className="workspace-muted">
                  Select a folder in the sidebar.
                </p>
              </div>
            ) : files.length === 0 ? (
              <div className="workspace-state-center">
                <p className="workspace-muted">
                  No files yet. Upload to get started.
                </p>
              </div>
            ) : (
              files.map((file) => {
                const row = workspaceFileAsAttachmentRow(file);
                const status = effectiveParseStatus(row);
                const badge = parseStatusLabel(row);
                const parsing = status === "pending" || status === "running";
                return (
                  <article key={file.id} className="workspace-file-card">
                    <button
                      type="button"
                      className="workspace-file-card-main"
                      onClick={() => void openPreview(file)}
                    >
                      <span className="workspace-file-card-icon">
                        <FileText size={18} strokeWidth={2} aria-hidden />
                      </span>
                      <span className="workspace-file-card-text">
                        <span className="workspace-file-name">{file.filename}</span>
                        <span className="workspace-file-meta">
                          {formatBytes(file.sizeBytes)}
                          {parsing ? (
                            <Loader2 size={12} className="spin" aria-hidden />
                          ) : null}
                          <span className="workspace-parse-badge">{badge}</span>
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="workspace-file-delete"
                      aria-label={`Delete ${file.filename}`}
                      onClick={() => void handleDeleteFile(file)}
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </section>

        {previewOpen ? (
          <ResizableAside
            defaultWidth={520}
            minWidth={320}
            className="workspace-preview-aside"
          >
            <aside className="workspace-preview">
              <div className="workspace-preview-header">
                <h3>{previewTitle}</h3>
                <button
                  type="button"
                  className="workspace-preview-close"
                  aria-label="Close preview"
                  onClick={closePreview}
                >
                  <X size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
              <div className="workspace-preview-body">
                {previewLoading ? (
                  <div className="workspace-state-center" role="status">
                    <Loader2 size={20} className="spin" aria-hidden />
                    <span>Loading preview…</span>
                  </div>
                ) : previewBundle && previewFileId ? (
                  <DocumentPreviewPanel
                    bundle={previewBundle}
                    originalDownloadUrl={workspaceFileDownloadUrl(previewFileId)}
                    token={token}
                    resolveFigureUrl={resolvePreviewFigureUrl}
                  />
                ) : null}
              </div>
            </aside>
          </ResizableAside>
        ) : null}
      </div>
    </div>
  );
}
