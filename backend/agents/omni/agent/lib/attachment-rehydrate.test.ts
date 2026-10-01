import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseSendAttachmentIdsFromMessages,
  parseWorkspaceFileIdsFromMessages,
} from "./attachment-rehydrate.js";

describe("parseWorkspaceFileIdsFromMessages", () => {
  it("collects ids from Client context parts", () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: 'Client context: {"workspaceFileIds":["w1","w2"],"attachmentIds":["a1"]}',
          },
        ],
      },
    ];
    assert.deepEqual(parseWorkspaceFileIdsFromMessages(messages), ["w1", "w2"]);
    assert.deepEqual(parseSendAttachmentIdsFromMessages(messages), ["a1"]);
  });

  it("collects ids from Eve multiline client context format", () => {
    const messages = [
      {
        role: "user",
        kind: "context.instruction",
        content:
          'Client context:\n{"workspaceFileIds":["w-multi"],"attachmentIds":["a-multi"]}',
      },
    ];
    assert.deepEqual(parseWorkspaceFileIdsFromMessages(messages), ["w-multi"]);
    assert.deepEqual(parseSendAttachmentIdsFromMessages(messages), ["a-multi"]);
  });

  it("dedupes across messages", () => {
    const messages = [
      {
        content:
          'Client context: {"workspaceFileIds":["same-id"]}',
      },
      {
        content:
          'Client context: {"workspaceFileIds":["same-id"]}',
      },
    ];
    assert.deepEqual(parseWorkspaceFileIdsFromMessages(messages), ["same-id"]);
  });
});
