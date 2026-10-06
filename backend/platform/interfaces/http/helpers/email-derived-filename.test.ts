import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEmailDerivedPartFilename } from "../parse-internal.handlers.js";

describe("resolveEmailDerivedPartFilename", () => {
  it("uses field name when File.name is the generic multipart field", () => {
    const blob = new File([new Uint8Array([1])], "files", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    assert.equal(
      resolveEmailDerivedPartFilename(
        "LRQ00004961_5823300_Nest_Audit_Notes.docx",
        blob,
      ),
      "LRQ00004961_5823300_Nest_Audit_Notes.docx",
    );
  });

  it("prefers File.name when it is a real filename", () => {
    const blob = new File([new Uint8Array([1])], "report.pdf", {
      type: "application/pdf",
    });
    assert.equal(
      resolveEmailDerivedPartFilename("ignored_field", blob),
      "report.pdf",
    );
  });
});
