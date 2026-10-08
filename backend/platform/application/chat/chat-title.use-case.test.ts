import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldGenerateChatTitle } from "./chat-title.use-case.js";

describe("shouldGenerateChatTitle", () => {
  it("waits until the trigger turn", () => {
    assert.equal(
      shouldGenerateChatTitle({
        titleSource: null,
        userTurnCount: 2,
        triggerTurn: 3,
      }),
      false,
    );
  });

  it("retries after a missed or failed attempt", () => {
    assert.equal(
      shouldGenerateChatTitle({
        titleSource: null,
        userTurnCount: 9,
        triggerTurn: 3,
      }),
      true,
    );
  });

  it("leaves user and llm titles alone", () => {
    assert.equal(
      shouldGenerateChatTitle({
        titleSource: "llm",
        userTurnCount: 9,
        triggerTurn: 3,
      }),
      false,
    );
    assert.equal(
      shouldGenerateChatTitle({
        titleSource: "user",
        userTurnCount: 9,
        triggerTurn: 3,
      }),
      false,
    );
  });
});
