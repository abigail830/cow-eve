import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRegisteredAgentId } from "./agent-scope.js";

describe("resolveRegisteredAgentId", () => {
  it("defaults to omni", () => {
    assert.equal(resolveRegisteredAgentId(undefined), "omni");
  });

  it("accepts registered agent ids", () => {
    assert.equal(resolveRegisteredAgentId("omni"), "omni");
  });

  it("rejects unknown agent ids", () => {
    assert.throws(() => resolveRegisteredAgentId("not-a-real-agent"));
  });
});
