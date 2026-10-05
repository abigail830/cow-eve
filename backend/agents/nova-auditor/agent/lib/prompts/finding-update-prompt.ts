import {
  fillNovaTemplate,
  FINDINGS_OUTRO_TEMPLATE,
  NOVA_CHAT_SYSTEM_MESSAGE,
} from "./nova-verbatim-templates.js";

export function buildFindingUpdatePrompt(input: {
  sourceText: string;
  clientPlanSummary: string;
}): { system: string; user: string } {
  const text = `${input.sourceText.trim()}\n\nCorrection, Corrective Action and Timescale proposed by the client:\n${input.clientPlanSummary.trim()}`;
  const user = fillNovaTemplate(FINDINGS_OUTRO_TEMPLATE, { text });
  return { system: NOVA_CHAT_SYSTEM_MESSAGE, user };
}
