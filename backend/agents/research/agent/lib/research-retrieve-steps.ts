import type { RetrieveResult } from "./research-schemas.js";
import {
  assertReadyForRetrieve,
  assertRetrieveBudget,
  mergeRetrieveResult,
} from "./research-run-state.js";

export async function persistRetrieveResultStep(
  budgetMaxWeb: number,
  result: RetrieveResult,
): Promise<{
  subQuestionId: string;
  status: RetrieveResult["status"];
  findingCount: number;
  duplicateSkipped: number;
  gaps: string[];
  toolsUsed: RetrieveResult["toolsUsed"];
}> {
  "use step";
  assertReadyForRetrieve();
  assertRetrieveBudget(budgetMaxWeb);

  if (result.toolsUsed.web > budgetMaxWeb) {
    throw new Error(
      `Retrieve used ${result.toolsUsed.web} web calls; budget was ${budgetMaxWeb}.`,
    );
  }

  const { findingCount, duplicateSkipped } = mergeRetrieveResult(result);

  return {
    subQuestionId: result.subQuestionId,
    status: result.status,
    findingCount,
    duplicateSkipped,
    gaps: result.gaps,
    toolsUsed: result.toolsUsed,
  };
}
