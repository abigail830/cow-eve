import { defineTool } from "eve/tools";
import { z } from "zod";
import { writeLedgerFilesFromState, writePlanFile } from "../lib/research-ledger-files.js";
import {
  markInitialized,
  resetResearchRunState,
} from "../lib/research-run-state.js";

export default defineTool({
  description:
    "Initialize the research ledger under /workspace/research (plan.md, progress.md, evidence.jsonl). " +
    "Call once after you show the research plan and before any research_retrieve calls.",
  inputSchema: z.object({
    planMarkdown: z
      .string()
      .min(40)
      .describe(
        "Full plan content to persist as plan.md (include goal, sub-questions, and sources).",
      ),
    resetLedger: z
      .boolean()
      .optional()
      .describe("When true, clears in-session evidence state before writing."),
  }),
  async execute({ planMarkdown, resetLedger }, ctx) {
    if (resetLedger) {
      resetResearchRunState();
    }
    markInitialized();
    const sandbox = await ctx.getSandbox();
    await writePlanFile(sandbox, planMarkdown);
    const synced = await writeLedgerFilesFromState(sandbox);
    return {
      status: "ok",
      planPath: "/workspace/research/plan.md",
      evidenceLines: synced.evidenceLines,
      progressRows: synced.progressRows,
    };
  },
});
