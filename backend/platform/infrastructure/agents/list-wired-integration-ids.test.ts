import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  connectionFilenameToIntegrationId,
  listWiredIntegrationIdsForPlatformAgent,
} from "./list-wired-integration-ids.js";

describe("connectionFilenameToIntegrationId", () => {
  it("maps kebab-case connection files to catalog ids", () => {
    assert.equal(connectionFilenameToIntegrationId("notion.ts"), "notion");
    assert.equal(
      connectionFilenameToIntegrationId("hybrid-search.ts"),
      "hybrid_search",
    );
    assert.equal(
      connectionFilenameToIntegrationId("zhipu-web-search.ts"),
      "zhipu_web_search",
    );
  });
});

describe("listWiredIntegrationIdsForPlatformAgent", () => {
  it("reads omni Eve connections directory", () => {
    const ids = listWiredIntegrationIdsForPlatformAgent("omni");
    assert.ok(ids.includes("notion"));
    assert.ok(ids.includes("hubspot"));
    assert.ok(ids.includes("hybrid_search"));
    assert.ok(ids.includes("zhipu_web_search"));
    assert.ok(ids.includes("feishu"));
  });

  it("returns empty for unknown platform agent", () => {
    assert.deepEqual(
      listWiredIntegrationIdsForPlatformAgent("not-a-registry-agent"),
      [],
    );
  });

  it("wires proposal_knowledge only on x-proposal", () => {
    const omni = listWiredIntegrationIdsForPlatformAgent("omni");
    const xProposal = listWiredIntegrationIdsForPlatformAgent("x-proposal");
    assert.ok(!omni.includes("proposal_knowledge"));
    assert.ok(xProposal.includes("proposal_knowledge"));
    assert.ok(xProposal.includes("feishu"));
    assert.ok(!omni.includes("proposal_knowledge"));
  });
});
