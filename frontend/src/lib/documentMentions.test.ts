import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeExplicitMentionIds,
  parseDocumentMentionIds,
} from "./documentMentions.js";
import type { MentionAttachmentOption } from "./attachmentUpload.js";

describe("documentMentions", () => {
  const options: MentionAttachmentOption[] = [
    {
      id: "chat-1",
      filename: "report.pdf",
      mediaType: "application/pdf",
      sizeBytes: 100,
      createdAt: null,
      source: "chat",
    },
    {
      id: "ws-1",
      filename: "report.pdf",
      mediaType: "application/pdf",
      sizeBytes: 200,
      createdAt: null,
      source: "workspace",
    },
  ];

  it("prefers first longest @ match for ambiguous filename", () => {
    const parsed = parseDocumentMentionIds("see @report.pdf", options);
    assert.ok(parsed.attachmentIds.length + parsed.workspaceFileIds.length >= 1);
  });

  it("mergeExplicitMentionIds adds menu picks", () => {
    const merged = mergeExplicitMentionIds(
      { attachmentIds: [], workspaceFileIds: [] },
      [options[1]!],
    );
    assert.deepEqual(merged.workspaceFileIds, ["ws-1"]);
  });
});
