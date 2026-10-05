import {
  fillNovaTemplate,
  FINDINGS_INTRO_TEMPLATE,
  NOVA_CHAT_SYSTEM_MESSAGE,
} from "./nova-verbatim-templates.js";

export function buildFindingIntroPrompt(input: {
  sourceText: string;
  isoStandard: string;
}): { system: string; user: string } {
  const notesBlock = input.isoStandard.trim()
    ? `[Auditor context: audit standard ${input.isoStandard}]\n\n${input.sourceText}`
    : input.sourceText;
  const user = fillNovaTemplate(FINDINGS_INTRO_TEMPLATE, { text: notesBlock });
  return { system: NOVA_CHAT_SYSTEM_MESSAGE, user };
}
