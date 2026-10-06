import assert from "node:assert/strict";
import { File } from "node:buffer";
import { describe, it } from "node:test";
import {
  readBatchArtifactsFromForm,
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

describe("readBatchArtifactsFromForm", () => {
  it("reads content_md and meta_json upload parts", async () => {
    const form = new FormData();
    form.append(
      "content_md",
      new File([new TextEncoder().encode("# Hi")], "content.md", {
        type: "text/markdown",
      }),
    );
    form.append(
      "meta_json",
      new File([new TextEncoder().encode("{}")], "meta.json", {
        type: "application/json",
      }),
    );
    const batch = await readBatchArtifactsFromForm(form);
    assert.equal(batch.contentData.byteLength, 4);
    assert.equal(batch.metaData.byteLength, 2);
    assert.equal(batch.pageData, null);
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
