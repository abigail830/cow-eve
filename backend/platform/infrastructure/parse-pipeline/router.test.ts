import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePipeline } from "./router.js";

describe("resolvePipeline email", () => {
  it("routes email kind to email_standard", () => {
    assert.deepEqual(resolvePipeline("email"), {
      action: "parse",
      pipelineId: "email_standard",
    });
  });
});
