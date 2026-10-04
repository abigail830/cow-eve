import type { SandboxSession } from "eve/sandbox";
import { appendRetrieveResultToSandbox } from "./research-ledger-sandbox-write.js";
import type { RetrieveResult } from "./research-schemas.js";

export type LedgerWriteContext = {
  getSandbox: () => Promise<SandboxSession>;
};

export type RetrieveLedgerWrite =
  | {
      ledgerWritten: true;
      findingCount: number;
      duplicateSkipped: number;
      evidenceLines: number;
    }
  | {
      ledgerWritten: false;
      pendingRetrieve: RetrieveResult;
      ledgerError: string;
    };

/** Sandbox writes must run outside workflow `"use step"` (no sandbox in step async context). */
export async function persistRetrieveLedgerInToolContext(
  ctx: LedgerWriteContext,
  result: RetrieveResult,
): Promise<RetrieveLedgerWrite> {
  try {
    const sandbox = await ctx.getSandbox();
    const ledger = await appendRetrieveResultToSandbox(sandbox, result);
    return {
      ledgerWritten: true,
      findingCount: ledger.findingCount,
      duplicateSkipped: ledger.duplicateSkipped,
      evidenceLines: ledger.evidenceLines,
    };
  } catch (err) {
    return {
      ledgerWritten: false,
      pendingRetrieve: result,
      ledgerError:
        err instanceof Error ? err.message : "Failed to write research ledger.",
    };
  }
}
