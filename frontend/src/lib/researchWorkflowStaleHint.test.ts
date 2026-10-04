import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractToolErrorText,
  researchWorkflowStaleHint,
} from "./researchWorkflowStaleHint.js";

describe("researchWorkflowStaleHint", () => {
  it("detects Eve workflow registration errors", () => {
    const msg =
      'Tool "research_retrieve" is not registered as a workflow in this deployment (workflow//./agent/tools/research_retrieve//execute). The tool was renamed or removed after this run started.';
    assert.ok(researchWorkflowStaleHint(msg));
  });

  it("ignores unrelated tool output", () => {
    assert.equal(researchWorkflowStaleHint('{"ok":true}'), null);
  });

  it("extracts nested error fields", () => {
    assert.equal(
      extractToolErrorText({ error: "not registered as a workflow" }),
      "not registered as a workflow",
    );
  });
});
