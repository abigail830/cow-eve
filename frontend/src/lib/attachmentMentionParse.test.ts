import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMentionAttachmentSelectable,
  likelyNeedsParse,
  moveMentionSelectableIndex,
} from "./attachmentParseProgress";
import type { ChatAttachmentPublic } from "./attachmentUpload";

function row(
  overrides: Partial<ChatAttachmentPublic> & Pick<ChatAttachmentPublic, "filename">,
): ChatAttachmentPublic {
  return {
    id: "id",
    chatId: "chat",
    mediaType: "application/octet-stream",
    sizeBytes: 1,
    createdAt: "",
    parsePipelineId: null,
    parseJobId: null,
    parseStatus: null,
    ...overrides,
  };
}

describe("likelyNeedsParse eml", () => {
  it("treats .eml as needing parse", () => {
    assert.equal(likelyNeedsParse(row({ filename: "mail.eml" })), true);
  });
});

describe("isMentionAttachmentSelectable", () => {
  it("allows ready pdf", () => {
    assert.equal(
      isMentionAttachmentSelectable({
        filename: "a.pdf",
        mediaType: "application/pdf",
        parseStatus: "ready",
      }),
      true,
    );
  });

  it("blocks pending eml", () => {
    assert.equal(
      isMentionAttachmentSelectable({
        filename: "mail.eml",
        mediaType: "message/rfc822",
        parseStatus: "pending",
      }),
      false,
    );
  });

  it("allows images without parse", () => {
    assert.equal(
      isMentionAttachmentSelectable({
        filename: "shot.png",
        mediaType: "image/png",
        parseStatus: "pending",
      }),
      true,
    );
  });
});

describe("moveMentionSelectableIndex", () => {
  const options = [
    {
      filename: "a.eml",
      mediaType: "message/rfc822",
      parseStatus: "pending",
    },
    {
      filename: "b.pdf",
      mediaType: "application/pdf",
      parseStatus: "ready",
    },
  ];

  it("skips disabled when moving down", () => {
    assert.equal(moveMentionSelectableIndex(options, 0, 1), 1);
  });

  it("stays when no selectable in direction", () => {
    assert.equal(moveMentionSelectableIndex(options, 0, -1), 0);
  });
});
