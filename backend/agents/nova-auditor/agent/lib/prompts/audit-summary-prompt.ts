import { buildSummaryControls } from "../summary-controls.js";
import {
  AUDIT_SUMMARY_TEMPLATE,
  fillNovaTemplate,
  NOVA_CHAT_SYSTEM_MESSAGE,
} from "./nova-verbatim-templates.js";

export function buildAuditSummaryPrompt(input: {
  sourceText: string;
  length?: string;
  complexity?: string;
  focusAreas?: string;
}): { system: string; user: string } {
  const user = fillNovaTemplate(AUDIT_SUMMARY_TEMPLATE, {
    summary_controls: buildSummaryControls(input),
    transcription_text: input.sourceText,
  });
  return { system: NOVA_CHAT_SYSTEM_MESSAGE, user };
}
