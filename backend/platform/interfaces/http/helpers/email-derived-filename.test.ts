import assert from "node:assert/strict";
import { File } from "node:buffer";
import { describe, it } from "node:test";
import {
  readEmailDerivedPartsFromForm,
  resolveEmailDerivedPartFilename,
} from "../parse-internal.handlers.js";

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

describe("readEmailDerivedPartsFromForm", () => {
  it("reads multiple upload parts from FormData", async () => {
    const form = new FormData();
    form.append(
      "LRQ00004961_5823300_Nest_Audit_Notes.docx",
      new File([new Uint8Array([1, 2, 3])], "LRQ00004961_5823300_Nest_Audit_Notes.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    form.append(
      "LRQ4006489_Notes.docx",
      new File([new Uint8Array([4, 5])], "LRQ4006489_Notes.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    const parts = await readEmailDerivedPartsFromForm(form);
    assert.equal(parts.length, 2);
    assert.equal(parts[0]?.filename, "LRQ00004961_5823300_Nest_Audit_Notes.docx");
    assert.equal(parts[0]?.bytes.byteLength, 3);
    assert.equal(parts[1]?.filename, "LRQ4006489_Notes.docx");
  });
});
