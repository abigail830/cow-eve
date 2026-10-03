import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeHybridSearchApiKey,
  normalizeHttpUrl,
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

describe("normalizeHttpUrl", () => {
  it("rejects bare email addresses", () => {
    assert.equal(normalizeHttpUrl("abigail830@163.com"), null);
  });

  it("accepts hostnames and MCP paths", () => {
    assert.equal(
      normalizeHttpUrl(
        "https://cow-platform-ii.vercel.app/api/mcp/hybrid-search",
      ),
      "https://cow-platform-ii.vercel.app/api/mcp/hybrid-search",
    );
  });
});

describe("normalizeHybridSearchApiKey", () => {
  it("strips Bearer prefix", () => {
    assert.equal(normalizeHybridSearchApiKey("Bearer okf_abc"), "okf_abc");
  });
});
