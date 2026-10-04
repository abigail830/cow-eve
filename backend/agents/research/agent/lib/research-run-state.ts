import { defineState } from "eve/context";
import type { ResearchFinding, RetrieveResult } from "./research-schemas.js";
import {
  MAX_RETRIEVE_CALLS_PER_TURN,
  MAX_WEB_CALLS_PER_TURN,
} from "./research-schemas.js";

export type ProgressRow = {
  subQuestionId: string;
  status: string;
  retrieveCalls: number;
  webUsed: number;
  kbUsed: number;
  lastUpdated: string;
};

export type StoredFinding = ResearchFinding & {
  findingId: string;
  subQuestionId: string;
  recordedAt: string;
};

export type ResearchRunState = {
  initialized: boolean;
  retrieveCalls: number;
  webUsedTotal: number;
  findings: StoredFinding[];
  progress: ProgressRow[];
  existingFindingIds: string[];
};

function initialState(): ResearchRunState {
  return {
    initialized: false,
    retrieveCalls: 0,
    webUsedTotal: 0,
    findings: [],
    progress: [],
    existingFindingIds: [],
  };
}

export const researchRunState = defineState("research.run.v1", initialState);

/** Pure hash for workflow-safe bundles (no Node builtins). */
export function findingId(
  subQuestionId: string,
  claim: string,
  source: string,
): string {
  let h = 5381;
  const s = `${subQuestionId}\0${claim}\0${source}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function assertReadyForRetrieve(): void {
  const state = researchRunState.get();
  if (!state.initialized) {
    throw new Error(
      "Research ledger is not initialized. Call init_research_files with your plan first.",
    );
  }
}

export function assertRetrieveBudget(nextWeb: number): void {
  const state = researchRunState.get();
  if (state.retrieveCalls >= MAX_RETRIEVE_CALLS_PER_TURN) {
    throw new Error(
      `Retrieve budget exhausted (${MAX_RETRIEVE_CALLS_PER_TURN} calls per turn). Synthesize from existing evidence.`,
    );
  }
  if (state.webUsedTotal + nextWeb > MAX_WEB_CALLS_PER_TURN) {
    throw new Error(
      `Web search budget exhausted (${MAX_WEB_CALLS_PER_TURN} web calls per turn).`,
    );
  }
}

export function markInitialized(): void {
  researchRunState.update((s) => ({ ...s, initialized: true }));
}

export function mergeRetrieveResult(result: RetrieveResult): {
  findingCount: number;
  duplicateSkipped: number;
} {
  let duplicateSkipped = 0;
  let findingCount = 0;
  const now = new Date().toISOString();

  researchRunState.update((state) => {
    const existing = new Set(state.existingFindingIds);
    const newFindings: StoredFinding[] = [];

    for (const f of result.findings) {
      const id = findingId(result.subQuestionId, f.claim, f.source);
      if (existing.has(id)) {
        duplicateSkipped += 1;
        continue;
      }
      existing.add(id);
      newFindings.push({
        ...f,
        findingId: id,
        subQuestionId: result.subQuestionId,
        recordedAt: now,
      });
      findingCount += 1;
    }

    const progressRow: ProgressRow = {
      subQuestionId: result.subQuestionId,
      status: result.status,
      retrieveCalls: 1,
      webUsed: result.toolsUsed.web,
      kbUsed: result.toolsUsed.kb,
      lastUpdated: now,
    };

    const progress = [...state.progress];
    const idx = progress.findIndex(
      (p) => p.subQuestionId === result.subQuestionId,
    );
    if (idx >= 0) {
      const prev = progress[idx]!;
      progress[idx] = {
        ...progressRow,
        retrieveCalls: prev.retrieveCalls + 1,
        webUsed: prev.webUsed + result.toolsUsed.web,
        kbUsed: prev.kbUsed + result.toolsUsed.kb,
      };
    } else {
      progress.push(progressRow);
    }

    return {
      ...state,
      retrieveCalls: state.retrieveCalls + 1,
      webUsedTotal: state.webUsedTotal + result.toolsUsed.web,
      findings: [...state.findings, ...newFindings],
      progress,
      existingFindingIds: [...existing],
    };
  });

  return { findingCount, duplicateSkipped };
}

export function hasEvidence(): boolean {
  return researchRunState.get().findings.length > 0;
}

export function resetResearchRunState(): void {
  researchRunState.update(() => initialState());
}
