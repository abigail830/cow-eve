import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findingId } from "./research-run-state.js";

describe("research-run-state", () => {
  it("findingId is stable for the same inputs", () => {
    assert.equal(findingId("Q1", "claim", "https://a"), findingId("Q1", "claim", "https://a"));
    assert.notEqual(findingId("Q1", "claim", "https://a"), findingId("Q2", "claim", "https://a"));
  });
});
