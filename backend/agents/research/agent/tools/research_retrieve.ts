import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { persistRetrieveResultStep } from "../lib/research-retrieve-steps.js";
import {
  MAX_KB_PER_RETRIEVE,
  MAX_WEB_PER_RETRIEVE,
  RetrieveResultSchema,
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
    "Return ONLY valid JSON matching the RetrieveResult schema. No markdown fences.",
  ].join("\n");
}

export default defineWorkflowTool({
  description:
    "Run one bounded retrieve sub-task (web/KB/HubSpot/workspace). Results are recorded in the session ledger automatically. " +
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
      outputSchema: RetrieveResultSchema,
      signal: ctx.abortSignal,
    });
    const { data, status, error } = await response.result();

    if (status === "failed" || data === undefined) {
      throw new Error(error?.message ?? "Retrieve subagent did not finish.");
    }

    if (data.subQuestionId !== input.subQuestionId) {
      throw new Error(
        `Retrieve subagent returned subQuestionId ${data.subQuestionId}; expected ${input.subQuestionId}.`,
      );
    }

    const summary = await persistRetrieveResultStep(input.budget.maxWeb, data);

    return {
      ...summary,
      syncHint: "Call sync_research_ledger before reading evidence files.",
    };
  },
});
