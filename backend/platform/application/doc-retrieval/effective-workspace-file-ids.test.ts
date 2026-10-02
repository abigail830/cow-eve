import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeWorkspaceFileIds } from "./effective-workspace-file-ids.js";

describe("mergeWorkspaceFileIds", () => {
  it("dedupes and preserves project, chat, then message order", () => {
    assert.deepEqual(
      mergeWorkspaceFileIds({
        projectFileIds: ["p1", "shared"],
        chatFileIds: ["c1", "shared"],
        messageFileIds: ["m1", "p1"],
      }),
      ["p1", "shared", "c1", "m1"],
    );
  });

  it("ignores blank ids", () => {
    assert.deepEqual(
      mergeWorkspaceFileIds({
        projectFileIds: ["  ", "a"],
        chatFileIds: [],
        messageFileIds: ["", "b"],
      }),
      ["a", "b"],
    );
  });
});
