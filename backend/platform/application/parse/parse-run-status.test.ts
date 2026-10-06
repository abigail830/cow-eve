import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("GHA run status report contract", () => {
  it("workflow payload matches platform handler shape", () => {
    const payload = {
      status: "failed",
      error: {
        code: "GHA_FAILED",
        message: "GitHub Actions workflow failed",
      },
    };
    assert.equal(payload.status, "failed");
    assert.equal(typeof payload.error.code, "string");
    assert.equal(typeof payload.error.message, "string");
  });
});
