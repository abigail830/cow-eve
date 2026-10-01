import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zhipuMcpAuthorizationHeader } from "./zhipu-mcp-auth.js";

describe("zhipuMcpAuthorizationHeader", () => {
  it("prefixes raw Coding Plan key with Bearer", () => {
    assert.equal(
      zhipuMcpAuthorizationHeader("abc123.key"),
      "Bearer abc123.key",
    );
  });

  it("normalizes existing Bearer prefix", () => {
    assert.equal(
      zhipuMcpAuthorizationHeader("Bearer abc123.key"),
      "Bearer abc123.key",
    );
    assert.equal(
      zhipuMcpAuthorizationHeader("bearer abc123.key"),
      "Bearer abc123.key",
    );
  });
});
