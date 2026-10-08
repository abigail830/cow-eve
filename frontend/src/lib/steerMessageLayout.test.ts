import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EveMessage } from "eve/react";
import {
  computeSteerSplitUpdates,
  expandSteeredAssistantMessages,
} from "./steerMessageLayout.js";

describe("steerMessageLayout", () => {
  it("records split index when a steer user message appears", () => {
    const prev = [
      {
        id: "a1",
        role: "assistant" as const,
        parts: [
          { type: "text" as const, text: "Before" },
          {
            type: "dynamic-tool" as const,
            toolName: "ask_question",
            toolCallId: "t1",
            state: "approval-requested" as const,
            input: {},
          },
        ],
      },
    ] as EveMessage[];
    const next = [
      ...prev,
      {
        id: "u2",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Never mind, list projects" }],
      },
    ] as EveMessage[];
    const splits = computeSteerSplitUpdates(prev, next, new Map());
    assert.equal(splits.get("a1"), 2);
  });

  it("expands assistant head, user, and streaming tail", () => {
    const messages = [
      {
        id: "a1",
        role: "assistant" as const,
        parts: [
          { type: "text" as const, text: "Before" },
          {
            type: "dynamic-tool" as const,
            toolName: "ask_question",
            toolCallId: "t1",
            state: "approval-requested" as const,
            input: {},
          },
          {
            type: "dynamic-tool" as const,
            toolName: "connection_execute",
            toolCallId: "t2",
            state: "output-available" as const,
            input: {},
            output: {},
          },
        ],
      },
      {
        id: "u2",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "List projects" }],
      },
    ] as EveMessage[];
    const expanded = expandSteeredAssistantMessages(
      messages,
      new Map([["a1", 2]]),
    );
    assert.equal(expanded.length, 3);
    assert.equal(expanded[0]?.id, "a1");
    assert.equal(expanded[0]?.parts.length, 2);
    assert.equal(expanded[1]?.id, "u2");
    assert.equal(expanded[2]?.id, "a1:steer:u2");
    assert.equal(expanded[2]?.parts.length, 1);
    assert.equal(
      expanded[2]?.parts[0]?.type === "dynamic-tool"
        ? expanded[2]?.parts[0]?.toolName
        : "",
      "connection_execute",
    );
  });

  it("places a steer user after the first reply when Eve inserts it in front", () => {
    const messages = [
      {
        id: "u1",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Draft the deck" }],
      },
      {
        id: "u2",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Here are the screenshots" }],
      },
      {
        id: "a1",
        role: "assistant" as const,
        parts: [
          { type: "text" as const, text: "Before I start" },
          {
            type: "dynamic-tool" as const,
            toolName: "ask_question",
            toolCallId: "q1",
            state: "approval-requested" as const,
            input: {},
          },
          { type: "reasoning" as const, text: "Second turn" },
          {
            type: "dynamic-tool" as const,
            toolName: "ask_question",
            toolCallId: "q2",
            state: "approval-requested" as const,
            input: {},
          },
        ],
      },
    ] as EveMessage[];

    const expanded = expandSteeredAssistantMessages(messages, new Map());
    assert.deepEqual(
      expanded.map((message) => message.id),
      ["u1", "a1", "u2", "a1:steer:u2"],
    );
    assert.equal(expanded[1]?.parts.length, 2);
    assert.equal(expanded[3]?.parts.length, 2);
    assert.equal(
      expanded[3]?.parts[1]?.type === "dynamic-tool"
        ? expanded[3].parts[1].toolCallId
        : "",
      "q2",
    );
  });
});
