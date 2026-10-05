import assert from "node:assert/strict";
import test from "node:test";
import {
  composeGenerationEvidenceText,
  extractLatestUserComposerNotes,
} from "./generation-evidence.js";

test("composeGenerationEvidenceText includes user message and evidence block", () => {
  const text = composeGenerationEvidenceText({
    notes: "Generate audit summary",
    documentBlocks: ["--- Evidence (from attachment reads) ---\nexcerpt"],
  });
  assert.match(text, /User message/);
  assert.match(text, /Evidence \(from attachment reads\)/);
});

test("extractLatestUserComposerNotes strips Client context", () => {
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: "@t.md please summarize" },
        {
          type: "text",
          text: 'Client context:\n{"attachmentIds":["id-1"],"workspaceFileIds":[]}',
        },
      ],
    },
  ];
  const notes = extractLatestUserComposerNotes(messages);
  assert.match(notes, /summarize/);
  assert.doesNotMatch(notes, /Client context/);
});
