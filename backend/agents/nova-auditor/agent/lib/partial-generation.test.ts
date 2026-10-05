import assert from "node:assert/strict";
import test from "node:test";
import { auditSummaryModelSchema } from "./generation-schemas.js";
import { pickStringFields, tryPartialParse } from "./partial-generation.js";

test("pickStringFields keeps string keys only", () => {
  const fields = pickStringFields({
    audit_subject: "Scope review",
    auditor: 42,
    auditees: "Jane",
  });
  assert.equal(fields.audit_subject, "Scope review");
  assert.equal(fields.auditees, "Jane");
  assert.equal(fields.auditor, undefined);
});

test("tryPartialParse recovers subset from fenced JSON", () => {
  const raw = '```json\n{"audit_subject":"A","auditor":"B"}\n```';
  const { fields, issues } = tryPartialParse(auditSummaryModelSchema, raw);
  assert.equal(fields.audit_subject, "A");
  assert.equal(fields.auditor, "B");
  assert.ok(issues.length > 0);
});
