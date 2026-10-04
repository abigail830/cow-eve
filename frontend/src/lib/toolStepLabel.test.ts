import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dynamicToolStepLabel } from "./toolStepLabel.js";

describe("dynamicToolStepLabel", () => {
  it("names retrieve and research_retrieve", () => {
    assert.equal(dynamicToolStepLabel("retrieve", {}), "Retrieve subagent");
    assert.equal(
      dynamicToolStepLabel("research_retrieve", {}),
      "Research retrieve",
    );
  });

  it("expands agent with message preview", () => {
    const label = dynamicToolStepLabel("agent", {
      message: "# Retrieve task (q1)\n\nObjective",
    });
    assert.match(label, /Subagent task:/);
    assert.match(label, /Retrieve task/);
  });
});
