import type { SandboxSession } from "eve/sandbox";
import { findingId } from "./research-finding-id.js";
import type { ResearchFinding, RetrieveResult } from "./research-schemas.js";
import {
  EVIDENCE_JSONL_PATH,
  PROGRESS_PATH,
  RESEARCH_DIR,
} from "./research-paths.js";

type StoredFinding = ResearchFinding & {
  findingId: string;
  subQuestionId: string;
  recordedAt: string;
};

type ProgressRow = {
  subQuestionId: string;
  status: string;
  retrieveCalls: number;
  webUsed: number;
  kbUsed: number;
  lastUpdated: string;
};

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

export function parseProgressTable(text: string): ProgressRow[] {
  const rows: ProgressRow[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.includes("Sub-question")) continue;
    if (trimmed.includes("---")) continue;
    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 6) continue;
    const retrieveCalls = Number.parseInt(cells[2] ?? "", 10);
    const webUsed = Number.parseInt(cells[3] ?? "", 10);
    const kbUsed = Number.parseInt(cells[4] ?? "", 10);
    if (
      Number.isNaN(retrieveCalls) ||
      Number.isNaN(webUsed) ||
      Number.isNaN(kbUsed)
    ) {
      continue;
    }
    rows.push({
      subQuestionId: cells[0]!,
      status: cells[1]!,
      retrieveCalls,
      webUsed,
      kbUsed,
      lastUpdated: cells[5]!,
    });
  }
  return rows;
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

async function ensureResearchDir(sandbox: SandboxSession): Promise<void> {
  await sandbox.run({
    command: `mkdir -p ${RESEARCH_DIR}`,
  });
}

/** Workflow-safe: no defineState / async_hooks imports. */
export async function appendRetrieveResultToSandbox(
  sandbox: SandboxSession,
  result: RetrieveResult,
): Promise<{ findingCount: number; duplicateSkipped: number; evidenceLines: number }> {
  await ensureResearchDir(sandbox);

  let existing: StoredFinding[] = [];
  try {
    const text = await sandbox.readTextFile({ path: EVIDENCE_JSONL_PATH });
    if (text?.trim()) {
      existing = parseEvidenceJsonl(text);
    }
  } catch {
    /* empty */
  }

  const existingIds = new Set(existing.map((f) => f.findingId));
  const now = new Date().toISOString();
  let findingCount = 0;
  let duplicateSkipped = 0;
  const appended: StoredFinding[] = [];

  for (const f of result.findings) {
    const id = findingId(result.subQuestionId, f.claim, f.source);
    if (existingIds.has(id)) {
      duplicateSkipped += 1;
      continue;
    }
    existingIds.add(id);
    appended.push({
      ...f,
      findingId: id,
      subQuestionId: result.subQuestionId,
      recordedAt: now,
    });
    findingCount += 1;
  }

  const allFindings = [...existing, ...appended];
  const jsonl =
    allFindings.length === 0
      ? ""
      : `${allFindings.map(findingToJsonlLine).join("\n")}\n`;
  await sandbox.writeTextFile({ path: EVIDENCE_JSONL_PATH, content: jsonl });

  let progress: ProgressRow[] = [];
  try {
    const progressText = await sandbox.readTextFile({ path: PROGRESS_PATH });
    if (progressText?.trim()) {
      progress = parseProgressTable(progressText);
    }
  } catch {
    /* empty */
  }

  const progressRow: ProgressRow = {
    subQuestionId: result.subQuestionId,
    status: result.status,
    retrieveCalls: 1,
    webUsed: result.toolsUsed.web,
    kbUsed: result.toolsUsed.kb,
    lastUpdated: now,
  };
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

  await sandbox.writeTextFile({
    path: PROGRESS_PATH,
    content: formatProgressTable(progress),
  });

  return {
    findingCount,
    duplicateSkipped,
    evidenceLines: allFindings.length,
  };
}
