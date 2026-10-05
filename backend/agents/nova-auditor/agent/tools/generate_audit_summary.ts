import { defineTool } from "eve/tools";
import { z } from "zod";
import { auditSummaryToEnvelope } from "../lib/draft-mappers.js";
import { auditSummaryModelSchema } from "../lib/generation-schemas.js";
import { toGenerationModelOutput } from "../lib/generation-tool-output.js";
import { buildAuditSummaryPrompt } from "../lib/prompts/audit-summary-prompt.js";
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
    "ONLY when asked to generate an audit summary (assessment summary). Requires evidence_markdown from prior attachment_read/grep in the conversation.",
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

    const { system, user } = buildAuditSummaryPrompt({
      sourceText: resolved.source.text,
      length: input.length,
      complexity: input.complexity,
      focusAreas: input.focus_areas,
    });

    const gen = await runStructuredGeneration({
      system,
      user,
      schema: auditSummaryModelSchema,
    });

    if (!gen.ok) {
      const partial =
        degradedDraftFromRaw({
          schema: auditSummaryModelSchema,
          rawExcerpt: gen.rawExcerpt,
          parseIssues: gen.issues,
          expectedKeys: [
            "audit_subject",
            "auditor",
            "auditees",
            "objective_evidence_process_controls_reviewed_and_comments",
          ],
          toEnvelope: (fields) => auditSummaryToEnvelope(fields, "degraded"),
        }) ??
        buildEnvelope({
          templateId: "audit.summary",
          title: "Audit Summary",
          status: "degraded",
          sections: [
            {
              id: "audit_subject",
              label: "Audit subject",
              body: "—",
              flags: ["verify"],
            },
            {
              id: "auditor",
              label: "Auditor",
              body: "—",
              artExclude: true,
              flags: ["verify"],
            },
            {
              id: "auditees",
              label: "Auditee(s)",
              body: "—",
              artExclude: true,
              flags: ["verify"],
            },
            {
              id: "objective_evidence",
              label: "Objective evidence, process controls reviewed and comments",
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
        auditSummaryToEnvelope(gen.data),
        resolved.source.text,
      ),
    };
  },
  toModelOutput: toGenerationModelOutput,
});
