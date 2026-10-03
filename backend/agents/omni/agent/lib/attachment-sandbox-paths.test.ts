import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTACHMENTS_ROOT,
  candidateAttachmentSandboxPaths,
  eveStagedAttachmentPath,
} from "./attachment-sandbox-paths.js";

describe("attachment sandbox paths", () => {
  it("stages under Eve attachment root", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const staged = eveStagedAttachmentPath(bytes, "report.pdf");
    assert.ok(staged.startsWith(ATTACHMENTS_ROOT));
    assert.equal(candidateAttachmentSandboxPaths(bytes, "report.pdf")[0], staged);
  });
});
