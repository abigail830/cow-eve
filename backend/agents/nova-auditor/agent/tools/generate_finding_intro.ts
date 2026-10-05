import { defineTool } from "eve/tools";
import { z } from "zod";
import { findingIntroToEnvelope } from "../lib/draft-mappers.js";
import { findingIntroModelSchema } from "../lib/generation-schemas.js";
import { toGenerationModelOutput } from "../lib/generation-tool-output.js";
import { buildFindingIntroPrompt } from "../lib/prompts/finding-intro-prompt.js";
import {
  generationEvidenceInputSchema,
  resolveGenerationSource,
} from "../lib/resolve-generation-source.js";
import { runStructuredGeneration } from "../lib/run-structured-generation.js";
import type { GenerationToolResult } from "../lib/structured-draft.js";
import { buildEnvelope } from "../lib/structured-draft.js";
import {
  degradedDraftFromRaw,
  finalizeGenerationDraft,
} from "../lib/finalize-generation-draft.js";

const ISO_PATTERN = /\bISO\s*\d+/i;

export default defineTool({
  description:
    "ONLY when asked to generate a new finding (clause, statement, requirement, evidence). Requires ISO standard and evidence_markdown from attachment_read/grep.",
  inputSchema: generationEvidenceInputSchema.extend({
    iso_standard: z
      .string()
      .optional()
      .describe("e.g. ISO 9001 or ISO 14001. Required unless present in evidence_markdown."),
    grade: z.string().optional().describe("Minor/Major if known."),
  }),
  async execute(input, ctx): Promise<GenerationToolResult> {
    const resolved = await resolveGenerationSource(
      {
        evidenceMarkdown: input.evidence_markdown,
        citationAttachmentIds: input.citation_attachment_ids,
      },
      ctx,
    );
    if (!resolved.ok) {
      return { status: "error", message: resolved.message };
    }

    const iso =
      input.iso_standard?.trim() ||
      (ISO_PATTERN.exec(resolved.source.text)?.[0] ?? "");
    if (!iso) {
      return {
        status: "needs_input",
        draft: buildEnvelope({
          templateId: "audit.finding_intro",
          title: "Finding (introduction)",
          status: "needs_input",
          sections: [],
          needsInput: {
            code: "missing_iso",
            message:
              "Provide the ISO standard reference (e.g. ISO 9001) before generating finding paragraphs.",
          },
        }),
      };
    }

    const { system, user } = buildFindingIntroPrompt({
      sourceText: resolved.source.text,
      isoStandard: iso,
    });

    const gen = await runStructuredGeneration({
      system,
      user,
      schema: findingIntroModelSchema,
    });

    if (!gen.ok) {
      const partial =
        degradedDraftFromRaw({
          schema: findingIntroModelSchema,
          rawExcerpt: gen.rawExcerpt,
          parseIssues: gen.issues,
          expectedKeys: [
            "clause",
            "statement_of_non_conformity",
            "requirement",
            "evidence_of_non_conformity",
          ],
          toEnvelope: (fields) => findingIntroToEnvelope(fields, { standard: iso, grade: input.grade }, "degraded"),
        }) ??
        buildEnvelope({
          templateId: "audit.finding_intro",
          title: "Finding (introduction)",
          status: "degraded",
          sections: [
            { id: "clause", label: "Clause", body: "—", flags: ["verify"] },
            {
              id: "statement_of_non_conformity",
              label: "Statement of Non-Conformity",
              body: "—",
              flags: ["verify"],
            },
            { id: "requirement", label: "Requirement", body: "—", flags: ["verify"] },
            {
              id: "evidence_of_non_conformity",
              label: "Evidence of Non-Conformity",
              body: "—",
              flags: ["verify"],
            },
          ],
          rawExcerpt: gen.rawExcerpt,
          parseIssues: gen.issues,
          meta: { standard: iso, grade: input.grade },
        });
      return {
        status: "degraded",
        parseIssues: partial.parseIssues,
        rawExcerpt: gen.rawExcerpt,
        draft: finalizeGenerationDraft(partial, resolved.source.text),
      };
    }

    return {
      status: "ok",
      draft: finalizeGenerationDraft(
        findingIntroToEnvelope(gen.data, {
          standard: iso,
          grade: input.grade,
        }),
        resolved.source.text,
      ),
    };
  },
  toModelOutput: toGenerationModelOutput,
});
