import { defineTool } from "eve/tools";
import { z } from "zod";
import { persistRetrieveLedgerInToolContext } from "../lib/persist-retrieve-ledger.js";
import {
  hydrateResearchStateFromSandbox,
  planFileExists,
  writeLedgerFilesFromState,
} from "../lib/research-ledger-files.js";
import { RetrieveResultSchema } from "../lib/research-schemas.js";
import {
  mergeRetrieveResult,
  researchRunState,
} from "../lib/research-run-state.js";

export default defineTool({
  description:
    "Flush in-session research evidence and progress into /workspace/research/evidence.jsonl and progress.md. " +
    "Call after each research_retrieve and before synthesizing the report from files. " +
    "When research_retrieve returned ledgerWritten false, pass its pendingRetrieve here.",
  inputSchema: z.object({
    pendingRetrieve: RetrieveResultSchema.optional().describe(
      "Copy from research_retrieve when ledgerWritten was false.",
    ),
  }),
  async execute({ pendingRetrieve }, ctx) {
    if (pendingRetrieve) {
      const pendingWrite = await persistRetrieveLedgerInToolContext(
        ctx,
        pendingRetrieve,
      );
      if (!pendingWrite.ledgerWritten) {
        return {
          status: "error",
          message: pendingWrite.ledgerError,
          evidenceLines: 0,
          progressRows: 0,
          retrieveCalls: researchRunState.get().retrieveCalls,
          webUsedTotal: researchRunState.get().webUsedTotal,
        };
      }
      mergeRetrieveResult(pendingRetrieve);
    }
    const sandbox = await ctx.getSandbox();
    if (await planFileExists(sandbox)) {
      await hydrateResearchStateFromSandbox(sandbox);
    }
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
