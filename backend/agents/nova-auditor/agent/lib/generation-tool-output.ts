import { toolOutput } from "eve/tools";
import type { GenerationToolResult } from "./structured-draft.js";
import { draftToMarkdown } from "./structured-draft.js";

export function toGenerationModelOutput(result: GenerationToolResult) {
  if (result.status === "error") {
    return toolOutput.text(result.message ?? "Generation failed.");
  }
  if (result.status === "needs_input" && result.draft?.needsInput) {
    return toolOutput.text(result.draft.needsInput.message);
  }
  if (result.draft) {
    return toolOutput.text(draftToMarkdown(result.draft));
  }
  return toolOutput.text(result.message ?? "Generation completed.");
}
