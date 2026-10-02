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
import { FileText, Loader2, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { formatBytes } from "../lib/attachments";
import { useAuth } from "../lib/auth";
import type { ChatAttachmentPublic } from "../lib/attachmentUpload";
import {
  ATTACHMENT_PARSE_POLL_MS,
  attachmentNeedsParsePoll,
  effectiveParseStatus,
  isAttachmentReadyForSend,
  parseStatusLabel,
} from "../lib/attachmentParseProgress";
import { AttachmentParseDrawer } from "./AttachmentParseDrawer";
import { workspaceFileAsAttachmentRow } from "../lib/workspaceParse";
import {
  deleteWorkspaceFile,
  fetchWorkspaceFilePreviewBundle,
  fetchWorkspaceFiles,
  retryWorkspaceFileParse,
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
  const [fileDropActive, setFileDropActive] = useState(false);
  const fileDropDepthRef = useRef(0);
  const [retryParseFileId, setRetryParseFileId] = useState<string | null>(null);
  const [parseDrawerFileId, setParseDrawerFileId] = useState<string | null>(
    null,
  );

  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );

  const previewOpen = Boolean(previewTitle);

  const parseDrawerAttachment = useMemo((): ChatAttachmentPublic | null => {
    if (!parseDrawerFileId) return null;
    const file = files.find((f) => f.id === parseDrawerFileId);
    return file ? workspaceFileAsAttachmentRow(file) : null;
  }, [files, parseDrawerFileId]);

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
      if (parseDrawerFileId === file.id) {
        setParseDrawerFileId(null);
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

  const handleRetryParse = useCallback(
    async (fileId: string) => {
      setRetryParseFileId(fileId);
      setError(null);
      try {
        await retryWorkspaceFileParse(fileId);
        await reloadFiles();
        if (previewFileId === fileId) {
          const bundle = await fetchWorkspaceFilePreviewBundle(fileId);
          setPreviewBundle(bundle);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Retry parse failed");
      } finally {
        setRetryParseFileId(null);
      }
    },
    [previewFileId, reloadFiles],
  );

  function openFilePanel(file: WorkspaceFilePublic) {
    const row = workspaceFileAsAttachmentRow(file);
    if (isAttachmentReadyForSend(row)) {
      void openPreview(file);
      return;
    }
    setParseDrawerFileId(file.id);
  }

  async function openPreview(file: WorkspaceFilePublic) {
    setParseDrawerFileId(null);
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

  function dragHasExternalFiles(dataTransfer: DataTransfer): boolean {
    return [...dataTransfer.types].some(
      (type) => type === "Files" || type === "application/x-moz-file",
    );
  }

  function onFileListDragEnter(e: React.DragEvent) {
    if (!selectedFolderId || uploading) return;
    if (!dragHasExternalFiles(e.dataTransfer)) return;
    e.preventDefault();
    fileDropDepthRef.current += 1;
    setFileDropActive(true);
  }

  function onFileListDragLeave(e: React.DragEvent) {
    if (!dragHasExternalFiles(e.dataTransfer)) return;
    fileDropDepthRef.current = Math.max(0, fileDropDepthRef.current - 1);
    if (fileDropDepthRef.current === 0) setFileDropActive(false);
  }

  function onFileListDragOver(e: React.DragEvent) {
    if (!selectedFolderId || uploading) return;
    if (!dragHasExternalFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function onFileListDrop(e: React.DragEvent) {
    e.preventDefault();
    fileDropDepthRef.current = 0;
    setFileDropActive(false);
    if (!selectedFolderId || uploading) return;
    if (!dragHasExternalFiles(e.dataTransfer)) return;
    if (e.dataTransfer.files.length === 0) return;
    void handleUpload(e.dataTransfer.files);
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

  const listColumn = (
    <>
      {listHeader}
      {error ? (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      ) : null}
      <div
        className={
          fileDropActive
            ? "workspace-file-list workspace-file-list--drop-target"
            : "workspace-file-list"
        }
        onDragEnter={onFileListDragEnter}
        onDragLeave={onFileListDragLeave}
        onDragOver={onFileListDragOver}
        onDrop={onFileListDrop}
      >
            {fileDropActive ? (
              <div className="workspace-drop-hint" aria-hidden>
                Drop files to upload to {selectedFolder?.name ?? "this folder"}
              </div>
            ) : null}
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
                  No files yet. Upload or drag files here.
                </p>
              </div>
            ) : (
              files.map((file) => {
                const row = workspaceFileAsAttachmentRow(file);
                const status = effectiveParseStatus(row);
                const badge = parseStatusLabel(row);
                const parsing = status === "pending" || status === "running";
                const failed = status === "failed";
                const readyBadge =
                  !parsing && !failed && isAttachmentReadyForSend(row);
                const parseErrorHint = file.parseErrorMessage?.trim() || null;
                const retryBusy = retryParseFileId === file.id;
                return (
                  <article key={file.id} className="workspace-file-card">
                    <button
                      type="button"
                      className="workspace-file-card-main"
                      onClick={() => openFilePanel(file)}
                    >
                      <span className="workspace-file-card-icon">
                        <FileText size={16} strokeWidth={2} aria-hidden />
                      </span>
                      <span className="workspace-file-card-title-row">
                        <span className="workspace-file-name">{file.filename}</span>
                        <span
                          className={
                            parsing
                              ? "workspace-parse-badge workspace-parse-badge--busy"
                              : failed
                                ? "workspace-parse-badge workspace-parse-badge--failed"
                                : readyBadge
                                  ? "workspace-parse-badge workspace-parse-badge--ready"
                                  : "workspace-parse-badge"
                          }
                          title={
                            failed && parseErrorHint
                              ? parseErrorHint
                              : undefined
                          }
                        >
                          {parsing ? (
                            <Loader2
                              size={11}
                              className="spin"
                              aria-hidden
                            />
                          ) : null}
                          {badge}
                        </span>
                      </span>
                      <span className="workspace-file-size">
                        {formatBytes(file.sizeBytes)}
                      </span>
                    </button>
                    {failed ? (
                      <button
                        type="button"
                        className="workspace-file-retry"
                        aria-label={`Retry parse for ${file.filename}`}
                        title="Retry parse"
                        disabled={retryBusy}
                        onClick={() => void handleRetryParse(file.id)}
                      >
                        {retryBusy ? (
                          <Loader2 size={14} className="spin" aria-hidden />
                        ) : (
                          <RotateCcw size={14} strokeWidth={2} aria-hidden />
                        )}
                      </button>
                    ) : null}
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
    </>
  );

  return (
    <div className="workspace-panel">
      <div className="workspace-panel-body">
        {previewOpen ? (
          <ResizableAside
            persistKey="workspace-preview-list-width"
            defaultWidthRatio={0.4}
            minWidth={280}
            maxWidthRatio={0.55}
            handlePlacement="inside"
            handleSide="trailing"
            className="workspace-list-resizable"
          >
            <section className="workspace-list-column">{listColumn}</section>
          </ResizableAside>
        ) : (
          <section className="workspace-list-column">{listColumn}</section>
        )}

        {previewOpen ? (
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
                  onRetryParse={
                    previewBundle.file.parseStatus === "failed"
                      ? () => void handleRetryParse(previewFileId)
                      : undefined
                  }
                  retryParseBusy={retryParseFileId === previewFileId}
                />
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      <AttachmentParseDrawer
        attachment={parseDrawerAttachment}
        onClose={() => setParseDrawerFileId(null)}
        onRetry={async (row) => {
          await handleRetryParse(row.id);
        }}
      />
    </div>
  );
}
