import type { SandboxSession } from "eve/sandbox";
import {
  EVIDENCE_JSONL_PATH,
  PLAN_PATH,
  PROGRESS_PATH,
  RESEARCH_DIR,
} from "./research-paths.js";
import { researchRunState, type ProgressRow, type StoredFinding } from "./research-run-state.js";

const PROGRESS_HEADER = `# Research progress

| Sub-question | Status | Retrieve calls | Web used | KB used | Last updated |
|--------------|--------|----------------|----------|---------|--------------|
`;

function progressRowLine(row: ProgressRow): string {
  return `| ${row.subQuestionId} | ${row.status} | ${row.retrieveCalls} | ${row.webUsed} | ${row.kbUsed} | ${row.lastUpdated} |`;
}

function formatProgressTable(rows: ProgressRow[]): string {
  if (rows.length === 0) {
    return `${PROGRESS_HEADER}\n`;
  }
  return `${PROGRESS_HEADER}${rows.map(progressRowLine).join("\n")}\n`;
}

function findingToJsonlLine(f: StoredFinding): string {
  return JSON.stringify({
    findingId: f.findingId,
    subQuestionId: f.subQuestionId,
    claim: f.claim,
    source: f.source,
    confidence: f.confidence,
    recordedAt: f.recordedAt,
  });
}

export async function ensureResearchDir(sandbox: SandboxSession): Promise<void> {
  await sandbox.run({
    command: `mkdir -p ${RESEARCH_DIR}`,
  });
}

export async function writePlanFile(
  sandbox: SandboxSession,
  planMarkdown: string,
): Promise<void> {
  await ensureResearchDir(sandbox);
  await sandbox.writeTextFile({ path: PLAN_PATH, content: planMarkdown });
}

export async function writeLedgerFilesFromState(
  sandbox: SandboxSession,
): Promise<{ evidenceLines: number; progressRows: number }> {
  await ensureResearchDir(sandbox);
  const state = researchRunState.get();
  const jsonl =
    state.findings.length === 0
      ? ""
      : `${state.findings.map(findingToJsonlLine).join("\n")}\n`;
  await sandbox.writeTextFile({ path: EVIDENCE_JSONL_PATH, content: jsonl });
  await sandbox.writeTextFile({
    path: PROGRESS_PATH,
    content: formatProgressTable(state.progress),
  });
  return {
    evidenceLines: state.findings.length,
    progressRows: state.progress.length,
  };
}

export async function planFileExists(sandbox: SandboxSession): Promise<boolean> {
  try {
    const text = await sandbox.readTextFile({ path: PLAN_PATH });
    return text !== null && text.trim().length > 0;
  } catch {
    return false;
  }
}

export async function evidenceFileHasContent(
  sandbox: SandboxSession,
): Promise<boolean> {
  try {
    const text = await sandbox.readTextFile({ path: EVIDENCE_JSONL_PATH });
    return text !== null && text.trim().length > 0;
  } catch {
    return false;
  }
}
