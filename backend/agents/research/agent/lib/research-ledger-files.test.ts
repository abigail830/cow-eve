import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SandboxSession } from "eve/sandbox";
import {
  appendRetrieveResultToSandbox,
  parseProgressTable,
} from "./research-ledger-sandbox-write.js";
import { EVIDENCE_JSONL_PATH, PROGRESS_PATH } from "./research-paths.js";

function mockSandbox(initial: Record<string, string> = {}): SandboxSession {
  const files = new Map(Object.entries(initial));
  return {
    async run() {},
    async readTextFile({ path }: { path: string }) {
      return files.has(path) ? files.get(path)! : null;
    },
    async writeTextFile({ path, content }: { path: string; content: string }) {
      files.set(path, content);
    },
  } as unknown as SandboxSession;
}

describe("appendRetrieveResultToSandbox", () => {
  it("writes evidence lines the parent sync can hydrate", async () => {
    const sandbox = mockSandbox();
    const ledger = await appendRetrieveResultToSandbox(sandbox, {
      subQuestionId: "q1",
      status: "done",
      findings: [
        {
          claim: "Deal A",
          source: "hubspot:deal:1",
          confidence: "high",
        },
      ],
      gaps: [],
      toolsUsed: { web: 0, kb: 0, hubspot: 1 },
    });
    assert.equal(ledger.findingCount, 1);
    assert.equal(ledger.evidenceLines, 1);
    const jsonl = await sandbox.readTextFile({ path: EVIDENCE_JSONL_PATH });
    assert.match(jsonl ?? "", /Deal A/);
    const progress = await sandbox.readTextFile({ path: PROGRESS_PATH });
    assert.match(progress ?? "", /q1/);
  });

  it("dedupes on replay", async () => {
    const sandbox = mockSandbox();
    const payload = {
      subQuestionId: "q1",
      status: "done" as const,
      findings: [
        {
          claim: "Same",
          source: "hubspot:deal:1",
          confidence: "med" as const,
        },
      ],
      gaps: [] as string[],
      toolsUsed: { web: 0, kb: 0, hubspot: 1 },
    };
    await appendRetrieveResultToSandbox(sandbox, payload);
    const second = await appendRetrieveResultToSandbox(sandbox, payload);
    assert.equal(second.findingCount, 0);
    assert.equal(second.duplicateSkipped, 1);
    assert.equal(second.evidenceLines, 1);
  });
});

describe("parseProgressTable", () => {
  it("reads progress rows from markdown", () => {
    const rows = parseProgressTable(`# Research progress

| Sub-question | Status | Retrieve calls | Web used | KB used | Last updated |
|--------------|--------|----------------|----------|---------|--------------|
| q1 | done | 2 | 1 | 0 | 2026-01-01T00:00:00.000Z |
`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.retrieveCalls, 2);
  });
});
