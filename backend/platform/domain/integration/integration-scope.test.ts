import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  integrationCredentialScopeForId,
  requireAgentIdForIntegration,
} from "./integration-scope.js";

describe("integration scope", () => {
  it("notion and hubspot are agent-scoped", () => {
    assert.equal(integrationCredentialScopeForId("notion"), "agent");
    assert.equal(integrationCredentialScopeForId("hubspot"), "agent");
  });

  it("hybrid search is user-scoped", () => {
    assert.equal(integrationCredentialScopeForId("hybrid_search"), "user");
  });

  it("requires agentId for agent-scoped integrations", () => {
    assert.throws(() => requireAgentIdForIntegration("notion", undefined));
    assert.equal(requireAgentIdForIntegration("notion", "omni"), "omni");
  });

  it("allows missing agentId for user-scoped integrations", () => {
    assert.equal(requireAgentIdForIntegration("hybrid_search", undefined), "");
  });
});
