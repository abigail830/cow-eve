import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import {
  persistRetrieveLedgerInToolContext,
  type LedgerWriteContext,
} from "../lib/persist-retrieve-ledger.js";
import { parseRetrieveAgentResult } from "../lib/research-retrieve-parse.js";
import {
  MAX_KB_PER_RETRIEVE,
  MAX_WEB_PER_RETRIEVE,
} from "../lib/research-schemas.js";

const AllowedSourceSchema = z.enum(["web", "kb", "hubspot", "workspace"]);

function buildRetrieveMessage(input: {
  subQuestionId: string;
  objective: string;
  allowedSources: z.infer<typeof AllowedSourceSchema>[];
  budget: { maxWeb: number; maxKb: number };
  contextFromPlan: string;
}): string {
  return [
    `# Retrieve task (${input.subQuestionId})`,
    "",
    "## Objective",
    input.objective,
    "",
    "## Allowed sources",
    input.allowedSources.join(", "),
    "",
    "## Budget (hard)",
    `- Web MCP calls: at most ${input.budget.maxWeb}`,
    `- KB hybrid_search calls: at most ${input.budget.maxKb}`,
    "",
    "## Plan context",
    input.contextFromPlan,
    "",
    "## JSON rules",
    `- Set "subQuestionId" to exactly "${input.subQuestionId}".`,
    '- Each finding "confidence" must be exactly one of: high, med, low (not "medium").',
  ].join("\n");
}

function assertPerRetrieveWebBudget(
  budgetMaxWeb: number,
  webUsed: number,
): void {
  if (webUsed > budgetMaxWeb) {
    throw new Error(
      `Retrieve used ${webUsed} web calls; budget was ${budgetMaxWeb}.`,
    );
  }
}

export default defineWorkflowTool({
  description:
    "Run one bounded retrieve sub-task (web/KB/HubSpot/workspace). Results are recorded in the session ledger when possible. " +
    "If the tool returns ledgerWritten false, call sync_research_ledger with the same pendingRetrieve payload. " +
    "Do not call MCP search tools directly from the parent agent.",
  inputSchema: z.object({
    subQuestionId: z.string().min(1).max(32),
    objective: z.string().min(10).max(4000),
    allowedSources: z.array(AllowedSourceSchema).min(1).max(4),
    budget: z
      .object({
        maxWeb: z.number().int().min(0).max(MAX_WEB_PER_RETRIEVE),
        maxKb: z.number().int().min(0).max(MAX_KB_PER_RETRIEVE),
      })
      .default({ maxWeb: MAX_WEB_PER_RETRIEVE, maxKb: MAX_KB_PER_RETRIEVE }),
    contextFromPlan: z.string().min(10).max(8000),
  }),
  async execute(input, ctx) {
    "use workflow";
    const message = buildRetrieveMessage(input);
    const response = await ctx.agent("retrieve").send(message, {
      signal: ctx.abortSignal,
    });
    const turn = await response.result();
    const data = parseRetrieveAgentResult(turn, input.subQuestionId);

    // Turn-level budgets are enforced in sync_research_ledger (defineState — not available in workflow steps).
    assertPerRetrieveWebBudget(input.budget.maxWeb, data.toolsUsed.web);

    const ledger = await persistRetrieveLedgerInToolContext(
      ctx as unknown as LedgerWriteContext,
      data,
    );

    if (!ledger.ledgerWritten) {
      return {
        subQuestionId: data.subQuestionId,
        status: data.status,
        findingCount: data.findings.length,
        duplicateSkipped: 0,
        evidenceLines: 0,
        gaps: data.gaps,
        toolsUsed: data.toolsUsed,
        ledgerWritten: false as const,
        pendingRetrieve: ledger.pendingRetrieve,
        ledgerError: ledger.ledgerError,
        syncHint:
          "Call sync_research_ledger with pendingRetrieve copied from this tool result.",
      };
    }

    return {
      subQuestionId: data.subQuestionId,
      status: data.status,
      findingCount: ledger.findingCount,
      duplicateSkipped: ledger.duplicateSkipped,
      evidenceLines: ledger.evidenceLines,
      gaps: data.gaps,
      toolsUsed: data.toolsUsed,
      ledgerWritten: true as const,
      syncHint: "Call sync_research_ledger before reading evidence files.",
    };
  },
});
