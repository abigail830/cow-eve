import { defineTool } from "eve/tools";
import { z } from "zod";
import { writeLedgerFilesFromState } from "../lib/research-ledger-files.js";
import { researchRunState } from "../lib/research-run-state.js";

export default defineTool({
  description:
    "Flush in-session research evidence and progress into /workspace/research/evidence.jsonl and progress.md. " +
    "Call after each research_retrieve and before synthesizing the report from files.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const sandbox = await ctx.getSandbox();
    const synced = await writeLedgerFilesFromState(sandbox);
    const state = researchRunState.get();
    return {
      status: "ok",
      evidenceLines: synced.evidenceLines,
      progressRows: synced.progressRows,
      retrieveCalls: state.retrieveCalls,
      webUsedTotal: state.webUsedTotal,
    };
  },
});
