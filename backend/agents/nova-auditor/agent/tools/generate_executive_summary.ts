import { defineTool } from "eve/tools";
import { z } from "zod";
import { executiveSummaryToEnvelope } from "../lib/draft-mappers.js";
import { executiveSummaryModelSchema } from "../lib/generation-schemas.js";
import { toGenerationModelOutput } from "../lib/generation-tool-output.js";
import { buildExecutiveSummaryPrompt } from "../lib/prompts/executive-summary-prompt.js";
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

export default defineTool({
  description:
    "ONLY when asked to generate an executive summary. Requires evidence_markdown from prior attachment_read/grep.",
  inputSchema: generationEvidenceInputSchema.extend({
    length: z.enum(["brief", "moderate", "detailed"]).optional(),
    complexity: z.enum(["simple", "balanced", "deep"]).optional(),
    focus_areas: z.string().optional(),
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

    const { system, user } = buildExecutiveSummaryPrompt({
      sourceText: resolved.source.text,
      length: input.length,
      complexity: input.complexity,
      focusAreas: input.focus_areas,
    });

    const gen = await runStructuredGeneration({
      system,
      user,
      schema: executiveSummaryModelSchema,
    });

    if (!gen.ok) {
      const partial =
        degradedDraftFromRaw({
          schema: executiveSummaryModelSchema,
          rawExcerpt: gen.rawExcerpt,
          parseIssues: gen.issues,
          expectedKeys: [
            "audit_outcome",
            "continual_improvement",
            "areas_for_senior_management_attention",
          ],
          toEnvelope: (fields) => executiveSummaryToEnvelope(fields, "degraded"),
        }) ??
        buildEnvelope({
          templateId: "audit.executive_summary",
          title: "Executive Summary",
          status: "degraded",
          sections: [
            { id: "audit_outcome", label: "Audit outcome", body: "—", flags: ["verify"] },
            {
              id: "continual_improvement",
              label: "Continual improvement",
              body: "—",
              flags: ["verify"],
            },
            {
              id: "areas_for_senior_management_attention",
              label: "Areas for senior management attention",
              body: "—",
              flags: ["verify"],
            },
          ],
          rawExcerpt: gen.rawExcerpt,
          parseIssues: gen.issues,
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
        executiveSummaryToEnvelope(gen.data),
        resolved.source.text,
      ),
    };
  },
  toModelOutput: toGenerationModelOutput,
});
