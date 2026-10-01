import { FileText, X } from "lucide-react";
import { parseStatusLabel } from "../lib/attachmentParseProgress";
import { workspaceFileAsAttachmentRow } from "../lib/workspaceParse";
import type { WorkspaceFilePublic } from "../lib/workspace";
import "./ComposerWorkspaceChips.css";

type Props = {
  files: readonly WorkspaceFilePublic[];
  onRemove: (fileId: string) => void;
};

export function ComposerWorkspaceChips({ files, onRemove }: Props) {
  if (files.length === 0) return null;

  return (
    <div className="composer-workspace-chips" aria-label="Workspace imports">
      {files.map((file) => {
        const row = workspaceFileAsAttachmentRow(file);
        const badge = parseStatusLabel(row);
        return (
          <span key={file.id} className="composer-workspace-chip">
            <FileText size={14} strokeWidth={2} aria-hidden />
            <span className="composer-workspace-chip-name">{file.filename}</span>
            <span className="composer-workspace-chip-source">Workspace</span>
            <span className="composer-workspace-chip-status">{badge}</span>
            <button
              type="button"
              className="composer-workspace-chip-remove"
              aria-label={`Remove ${file.filename}`}
              onClick={() => onRemove(file.id)}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </span>
        );
      })}
    </div>
  );
}
