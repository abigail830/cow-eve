import { defineTool } from "eve/tools";
import { findingUpdateToEnvelope } from "../lib/draft-mappers.js";
import { findingUpdateModelSchema } from "../lib/generation-schemas.js";
import { toGenerationModelOutput } from "../lib/generation-tool-output.js";
import { buildFindingUpdatePrompt } from "../lib/prompts/finding-update-prompt.js";
import {
  generationEvidenceInputSchema,
  resolveGenerationSource,
} from "../lib/resolve-generation-source.js";
import {
  runClientPlanExtract,
  runStructuredGeneration,
} from "../lib/run-structured-generation.js";
import type { GenerationToolResult } from "../lib/structured-draft.js";
import { buildEnvelope } from "../lib/structured-draft.js";
import {
  degradedDraftFromRaw,
  finalizeGenerationDraft,
} from "../lib/finalize-generation-draft.js";

export default defineTool({
  description:
    "ONLY when asked to update/close a finding with correction, root cause, and corrective action review paragraphs.",
  inputSchema: generationEvidenceInputSchema,
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

    const plan = await runClientPlanExtract(resolved.source.text);
    if (!plan.present) {
      return {
        status: "needs_input",
        draft: buildEnvelope({
          templateId: "audit.finding_update",
          title: "Finding update",
          status: "needs_input",
          sections: [],
          needsInput: {
            code: "missing_client_plan",
            message:
              "Include the client's proposed correction, corrective action, and timescale in your notes, then try again.",
          },
        }),
      };
    }

    const { system, user } = buildFindingUpdatePrompt({
      sourceText: resolved.source.text,
      clientPlanSummary: plan.summary,
    });

    const gen = await runStructuredGeneration({
      system,
      user,
      schema: findingUpdateModelSchema,
    });

    if (!gen.ok) {
      const partial =
        degradedDraftFromRaw({
          schema: findingUpdateModelSchema,
          rawExcerpt: gen.rawExcerpt,
          parseIssues: gen.issues,
          expectedKeys: [
            "correction_review",
            "root_cause_review",
            "corrective_action_review",
          ],
          toEnvelope: (fields) =>
            findingUpdateToEnvelope(fields, plan.summary, "degraded"),
        }) ??
        buildEnvelope({
          templateId: "audit.finding_update",
          title: "Finding update",
          status: "degraded",
          sections: [
            {
              id: "client_plan",
              label: "Correction, Corrective Action and Timescale proposed by the client",
              body: plan.summary,
            },
            { id: "correction_review", label: "Correction Review", body: "—", flags: ["verify"] },
            { id: "root_cause_review", label: "Root Cause Review", body: "—", flags: ["verify"] },
            {
              id: "corrective_action_review",
              label: "Corrective Action Review",
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
        findingUpdateToEnvelope(gen.data, plan.summary),
        resolved.source.text,
      ),
    };
  },
  toModelOutput: toGenerationModelOutput,
});
