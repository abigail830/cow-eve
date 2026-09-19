import { X } from "lucide-react";
import type { ArtifactSpec } from "@fde/artifact-spec";
import { ArtifactPreviewContent } from "./ArtifactPreviewContent";

type Props = {
  spec: ArtifactSpec;
  apiBase: string;
  token?: string | null;
  chatId?: string | null;
  onClose: () => void;
};

export function ArtifactPreviewPanel({ spec, apiBase, token, chatId, onClose }: Props) {
  return (
    <aside className="artifact-preview-panel" aria-label={`Preview: ${spec.title}`}>
      <div className="artifact-preview-panel-header">
        <strong className="artifact-preview-panel-title">{spec.title}</strong>
        <button
          type="button"
          className="artifact-preview-panel-close"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="artifact-preview-panel-body">
        <ArtifactPreviewContent spec={spec} apiBase={apiBase} token={token} chatId={chatId} />
      </div>
    </aside>
  );
}
