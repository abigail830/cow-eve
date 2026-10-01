import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDocumentLibraryAccess,
  findSessionDocuments,
  type DocumentIndexEntry,
} from "./session-document-library.js";

function entry(
  partial: Partial<DocumentIndexEntry> & Pick<DocumentIndexEntry, "refId" | "attachmentId" | "filename">,
): DocumentIndexEntry {
  return {
    mimeType: "application/pdf",
    kind: "pdf",
    parseStatus: "ready",
    gist: null,
    sectionTitles: [],
    lineCount: null,
    pageCount: null,
    figureCount: 0,
    createdAt: null,
    source: "chat",
    scopeId: "chat-1",
    ...partial,
  };
}

describe("assertDocumentLibraryAccess", () => {
  it("resolves ws: prefix and bare uuid", () => {
    const library = new Map<string, DocumentIndexEntry>([
      [
        "ws:abc",
        entry({
          refId: "ws:abc",
          attachmentId: "abc",
          filename: "report.pdf",
          source: "workspace",
        }),
      ],
    ]);
    assert.equal(
      assertDocumentLibraryAccess(library, "ws:abc").filename,
      "report.pdf",
    );
    assert.equal(
      assertDocumentLibraryAccess(library, "abc").filename,
      "report.pdf",
    );
  });

  it("throws not_found for missing ref", () => {
    const library = new Map<string, DocumentIndexEntry>();
    assert.throws(
      () => assertDocumentLibraryAccess(library, "ws:missing"),
      (err: unknown) =>
        err instanceof Error && err.message.includes("not found"),
    );
  });
});

describe("findSessionDocuments", () => {
  it("returns chat and workspace sources with scores", () => {
    const library = new Map<string, DocumentIndexEntry>([
      [
        "a1",
        entry({
          refId: "a1",
          attachmentId: "a1",
          filename: "budget.xlsx",
          source: "chat",
          gist: "Q1 numbers",
        }),
      ],
      [
        "ws:w1",
        entry({
          refId: "ws:w1",
          attachmentId: "w1",
          filename: "workspace-plan.pdf",
          source: "workspace",
        }),
      ],
    ]);
    const hits = findSessionDocuments(library, "budget", 5);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.source, "chat");
    assert.equal(hits[0]?.attachment_id, "a1");
  });
});
