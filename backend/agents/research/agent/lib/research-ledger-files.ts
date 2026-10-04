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

function parseEvidenceJsonl(text: string): StoredFinding[] {
  const findings: StoredFinding[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as Record<string, unknown>;
      if (
        typeof row.findingId === "string" &&
        typeof row.subQuestionId === "string" &&
        typeof row.claim === "string" &&
        typeof row.source === "string" &&
        (row.confidence === "high" ||
          row.confidence === "med" ||
          row.confidence === "low")
      ) {
        findings.push({
          findingId: row.findingId,
          subQuestionId: row.subQuestionId,
          claim: row.claim,
          source: row.source,
          confidence: row.confidence,
          recordedAt:
            typeof row.recordedAt === "string"
              ? row.recordedAt
              : new Date().toISOString(),
        });
      }
    } catch {
      /* skip bad line */
    }
  }
  return findings;
}

/** Merge sandbox ledger files into session state (workflow vs parent tool contexts). */
export async function hydrateResearchStateFromSandbox(
  sandbox: SandboxSession,
): Promise<void> {
  let findings: StoredFinding[] = [];
  try {
    const text = await sandbox.readTextFile({ path: EVIDENCE_JSONL_PATH });
    if (text?.trim()) {
      findings = parseEvidenceJsonl(text);
    }
  } catch {
    /* empty */
  }

  const progressMap = new Map<string, ProgressRow>();
  for (const f of findings) {
    const prev = progressMap.get(f.subQuestionId);
    progressMap.set(f.subQuestionId, {
      subQuestionId: f.subQuestionId,
      status: prev?.status ?? "done",
      retrieveCalls: prev?.retrieveCalls ?? 1,
      webUsed: prev?.webUsed ?? 0,
      kbUsed: prev?.kbUsed ?? 0,
      lastUpdated: f.recordedAt,
    });
  }

  const planOk = await planFileExists(sandbox);
  researchRunState.update(() => ({
    initialized: planOk,
    retrieveCalls: progressMap.size,
    webUsedTotal: 0,
    findings,
    progress: [...progressMap.values()],
    existingFindingIds: findings.map((f) => f.findingId),
  }));
}
