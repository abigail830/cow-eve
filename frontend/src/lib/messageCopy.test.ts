import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EveMessagePart } from "eve/react";
import { assistantMessageCopyText } from "./messageCopy.js";

describe("assistantMessageCopyText", () => {
  it("joins text and reasoning", () => {
    const parts = [
      { type: "text", text: "Hello **world**" },
      { type: "reasoning", text: "Thinking…" },
    ] as EveMessagePart[];
    const out = assistantMessageCopyText(parts);
    assert.match(out, /Hello \*\*world\*\*/);
    assert.match(out, /Reasoning/);
  });
});
