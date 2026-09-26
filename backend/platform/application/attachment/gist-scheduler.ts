import { isAttachmentGistEnabled } from "../../infrastructure/config/parse-pipeline.config.js";
import { generateAndSaveAttachmentGist } from "./attachment-gist.use-case.js";

const inflight = new Set<string>();

export function scheduleAttachmentGist(attachmentId: string): void {
  if (!isAttachmentGistEnabled()) return;
  if (inflight.has(attachmentId)) return;
  inflight.add(attachmentId);
  void generateAndSaveAttachmentGist(attachmentId)
    .catch((err) => {
      console.error("[gist] generation failed", attachmentId, err);
    })
    .finally(() => {
      inflight.delete(attachmentId);
    });
}
