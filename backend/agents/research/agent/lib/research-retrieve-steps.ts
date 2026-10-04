import type { WorkflowStepToolContext } from "eve/tools";
import type { RetrieveResult } from "./research-schemas.js";
import {
  assertRetrieveBudget,
  markInitialized,
} from "./research-run-state.js";

/** Durable budget gate only — no sandbox (unavailable inside `"use step"`). */
export async function persistRetrieveResultStep(
  _ctx: WorkflowStepToolContext,
  budgetMaxWeb: number,
  result: RetrieveResult,
): Promise<{ ok: true }> {
  "use step";
  markInitialized();

  assertRetrieveBudget(budgetMaxWeb);

  if (result.toolsUsed.web > budgetMaxWeb) {
    throw new Error(
      `Retrieve used ${result.toolsUsed.web} web calls; budget was ${budgetMaxWeb}.`,
    );
  }

  return { ok: true };
}
