import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INTEGRATION_HUBSPOT,
  INTEGRATION_NOTION,
} from "../../domain/integration/integration-catalog.js";
import { integrationsForAgent } from "./integrations-for-agent.js";

describe("integrationsForAgent", () => {
  it("includes integrations wired under omni Eve connections", () => {
    const ids = integrationsForAgent("omni").map((row) => row.id);
    assert.ok(ids.includes(INTEGRATION_NOTION));
    assert.ok(ids.includes(INTEGRATION_HUBSPOT));
    assert.ok(ids.includes("zhipu_web_search"));
  });

  it("excludes catalog entries when Eve has no connection file", () => {
    const ids = integrationsForAgent("some-future-agent").map((row) => row.id);
    assert.ok(!ids.includes(INTEGRATION_NOTION));
    assert.ok(!ids.includes(INTEGRATION_HUBSPOT));
  });
});
