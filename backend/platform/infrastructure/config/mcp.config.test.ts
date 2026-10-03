import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeHybridSearchApiKey,
  resolveHybridSearchApiBase,
} from "./mcp.config.js";

describe("resolveHybridSearchApiBase", () => {
  it("derives base from MCP URL suffix like agent-platform", () => {
    assert.equal(
      resolveHybridSearchApiBase(
        "https://cow-platform-ii.vercel.app/api/mcp/hybrid-search",
      ),
      "https://cow-platform-ii.vercel.app",
    );
  });
});

describe("normalizeHybridSearchApiKey", () => {
  it("strips Bearer prefix", () => {
    assert.equal(normalizeHybridSearchApiKey("Bearer okf_abc"), "okf_abc");
  });
});
