import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeConfidence,
  normalizeRetrievePayload,
} from "./normalize-retrieve-json.js";
import { RetrieveResultSchema } from "./research-schemas.js";

describe("normalizeRetrievePayload", () => {
  it("maps medium to med before schema parse", () => {
    const raw = normalizeRetrievePayload({
      subQuestionId: "q1",
      status: "done",
      findings: [
        {
          claim: "Proposal doc",
          source: "kb:hf-proposal",
          confidence: "medium",
        },
      ],
      gaps: [],
      toolsUsed: { web: 0, kb: 1, hubspot: 0 },
    });
    const parsed = RetrieveResultSchema.safeParse(raw);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.findings[0]?.confidence, "med");
  });

  it("normalizeConfidence handles common aliases", () => {
    assert.equal(normalizeConfidence("HIGH"), "high");
    assert.equal(normalizeConfidence("中"), "med");
    assert.equal(normalizeConfidence("unknown"), "med");
  });
});
