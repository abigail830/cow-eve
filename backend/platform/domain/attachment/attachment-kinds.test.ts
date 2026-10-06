import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyAttachment } from "./attachment-kinds.js";

describe("classifyAttachment email", () => {
  it("classifies .eml by extension", () => {
    assert.equal(
      classifyAttachment({ filename: "thread.eml", mimeType: "application/octet-stream" }),
      "email",
    );
  });

  it("classifies message/rfc822 mime", () => {
    assert.equal(
      classifyAttachment({ filename: "mail", mimeType: "message/rfc822" }),
      "email",
    );
  });
});
