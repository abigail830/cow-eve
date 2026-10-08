import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { utilityCompletionText } from "./utility-chat-completion.js";

describe("utilityCompletionText", () => {
  it("uses content when the model answered", () => {
    assert.equal(
      utilityCompletionText({ content: "Sales enablement deck", reasoning_content: "thinking" }),
      "Sales enablement deck",
    );
  });

  it("accepts a short final reasoning line when content is empty", () => {
    assert.equal(
      utilityCompletionText({
        content: "",
        reasoning_content: "Need a short noun phrase.\n保险经纪销售材料",
      }),
      "保险经纪销售材料",
    );
  });

  it("rejects a long chain of thought", () => {
    assert.equal(
      utilityCompletionText({
        content: null,
        reasoning_content: "x".repeat(120),
      }),
      "",
    );
  });
});
