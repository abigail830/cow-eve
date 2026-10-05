import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { extractJsonObject, parseWithSchema } from "./parse-generation-json.js";

describe("parse-generation-json", () => {
  it("extracts JSON from fenced block", () => {
    const raw = extractJsonObject('```json\n{"a":1}\n```');
    assert.deepEqual(raw, { a: 1 });
  });

  it("safeParse reports issues", () => {
    const schema = z.object({ name: z.string() });
    const parsed = parseWithSchema(schema, { name: 42 });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.ok(parsed.issues.length > 0);
    }
  });
});
