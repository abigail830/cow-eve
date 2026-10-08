import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MessageStreamEvent } from "eve/client";
import { historyNeedsResume } from "./chat-stream.js";

function ev(type: string): MessageStreamEvent {
  return { type, data: {} } as MessageStreamEvent;
}

describe("historyNeedsResume", () => {
  it("resumes when the tail is not session idle", () => {
    assert.equal(historyNeedsResume([ev("turn.started")]), true);
  });

  it("does not resume on session.waiting or session.completed", () => {
    assert.equal(historyNeedsResume([ev("session.waiting")]), false);
    assert.equal(historyNeedsResume([ev("session.completed")]), false);
  });

  it("does not resume on session.failed or terminal turn events", () => {
    assert.equal(historyNeedsResume([ev("session.failed")]), false);
    assert.equal(historyNeedsResume([ev("turn.failed")]), false);
    assert.equal(historyNeedsResume([ev("turn.cancelled")]), false);
  });
});
