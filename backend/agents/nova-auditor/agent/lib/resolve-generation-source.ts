import { z } from "zod";
import {
  composeGenerationEvidenceText,
  extractLatestUserComposerNotes,
} from "./generation-evidence.js";
import { readDynamicMessages } from "./attachment-rehydrate.js";

const MIN_EVIDENCE_CHARS = 40;
const MAX_EVIDENCE_CHARS = 120_000;

export type ResolvedSource = {
  text: string;
  warnings: string[];
  refIds: string[];
};

/**
 * Builds the Nova prompt evidence string for a generation tool call.
 * Conversation-first: the agent must gather excerpts via attachment_read / attachment_grep
 * across turns, then pass `evidence_markdown`. Platform only adds the latest composer notes
 * (user intent / short notes)—no automatic full-file load.
 */
export async function resolveGenerationSource(
  input: {
    evidenceMarkdown: string;
    citationAttachmentIds?: string[];
  },
  ctx: unknown,
): Promise<
  | { ok: true; source: ResolvedSource }
  | { ok: false; message: string }
> {
  const messages = readDynamicMessages(ctx);
  const composerNotes = extractLatestUserComposerNotes(messages);
  const evidence = input.evidenceMarkdown.trim();

  const text = composeGenerationEvidenceText({
    notes: composerNotes,
    documentBlocks: evidence ? [`--- Evidence (from attachment reads) ---\n${evidence}`] : [],
  });

  let finalText = text;
  const warnings: string[] = [];
  if (finalText.length > MAX_EVIDENCE_CHARS) {
    finalText = finalText.slice(0, MAX_EVIDENCE_CHARS);
    warnings.push("Evidence was truncated to the maximum allowed length.");
  }

  if (finalText.length < MIN_EVIDENCE_CHARS) {
    return {
      ok: false,
      message:
        "Not enough evidence for generation. Use attachment_read / attachment_grep on @mentioned files across the conversation, then call this tool with evidence_markdown containing the relevant excerpts (with filenames).",
    };
  }

  const refIds = (input.citationAttachmentIds ?? []).filter(Boolean);

  return {
    ok: true,
    source: { text: finalText, warnings, refIds },
  };
}

export const generationEvidenceInputSchema = z.object({
  evidence_markdown: z
    .string()
    .min(40)
    .describe(
      "Relevant excerpts for this deliverable only—obtained via attachment_read / attachment_grep in this thread. Use --- Document: filename --- sections. Do not paste the user's generate command or filler.",
    ),
  citation_attachment_ids: z
    .array(z.string())
    .optional()
    .describe("Optional attachment_id or ws:<uuid> values you cited in evidence_markdown."),
});
