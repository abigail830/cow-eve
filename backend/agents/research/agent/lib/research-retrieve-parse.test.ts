import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRetrieveAgentResult } from "./research-retrieve-parse.js";

describe("parseRetrieveAgentResult", () => {
  it("parses JSON from message text when structured output is missing", () => {
    const out = parseRetrieveAgentResult(
      {
        status: "waiting",
        message: JSON.stringify({
          subQuestionId: "sq1",
          status: "partial",
          findings: [
            { claim: "x", source: "https://example.com", confidence: "med" },
          ],
          gaps: [],
          toolsUsed: { web: 1, kb: 0, hubspot: 0 },
        }),
      },
      "sq1",
    );
    assert.equal(out.status, "partial");
    assert.equal(out.findings.length, 1);
  });

  it("returns blocked ledger row on garbage instead of throwing", () => {
    const out = parseRetrieveAgentResult(
      { status: "waiting", message: "Here is a summary without json." },
      "sq2",
    );
    assert.equal(out.status, "blocked");
    assert.equal(out.subQuestionId, "sq2");
    assert.ok(out.gaps[0]?.includes("JSON"));
  });
});
