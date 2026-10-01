import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientContextIdsFromMessageParts,
  collapseUserClientContextMessages,
  isClientContextOnlyMessage,
} from "./userMessageAttachments.js";

describe("userMessageAttachments workspace ids", () => {
  it("parses workspaceFileIds from client context", () => {
    const parts = [
      {
        type: "text" as const,
        text: 'Client context: {"workspaceFileIds":["f1"],"attachmentIds":["a1"]}',
      },
    ];
    assert.deepEqual(clientContextIdsFromMessageParts(parts), {
      attachmentIds: ["a1"],
      workspaceFileIds: ["f1"],
    });
  });

  it("merges client context into prior user turn", () => {
    const messages = [
      {
        id: "u1",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Summarize the doc" }],
      },
      {
        id: "u2",
        role: "user" as const,
        parts: [
          {
            type: "text" as const,
            text: 'Client context: {"workspaceFileIds":["f1"]}',
          },
        ],
      },
    ];
    assert.equal(isClientContextOnlyMessage(messages[1]), true);
    const collapsed = collapseUserClientContextMessages(messages);
    assert.equal(collapsed.length, 1);
    assert.deepEqual(collapsed[0]?.extraWorkspaceFileIds, ["f1"]);
  });
});
