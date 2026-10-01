import type { DocumentSourceKind } from "../../domain/document/document-scope.js";
import { isAttachmentGistEnabled } from "../../infrastructure/config/parse-pipeline.config.js";
import { generateAndSaveAttachmentGist } from "./attachment-gist.use-case.js";
import { generateAndSaveWorkspaceFileGist } from "./workspace-file-gist.use-case.js";

const inflight = new Set<string>();

function inflightKey(kind: DocumentSourceKind, fileId: string): string {
  return `${kind}:${fileId}`;
}

export function scheduleDocumentGist(
  kind: DocumentSourceKind,
  fileId: string,
): void {
  if (!isAttachmentGistEnabled()) return;
  const key = inflightKey(kind, fileId);
  if (inflight.has(key)) return;
  inflight.add(key);
  const task =
    kind === "workspace_file"
      ? generateAndSaveWorkspaceFileGist(fileId)
      : generateAndSaveAttachmentGist(fileId);
  void task
    .catch((err) => {
      console.error("[gist] generation failed", key, err);
    })
    .finally(() => {
      inflight.delete(key);
    });
}

/** @deprecated Use scheduleDocumentGist */
export function scheduleAttachmentGist(attachmentId: string): void {
  scheduleDocumentGist("chat_attachment", attachmentId);
}
