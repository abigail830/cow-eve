import type { StructuredDraftEnvelope } from "./structured-draft.js";
import { tryPartialParse } from "./partial-generation.js";
import { enrichEnvelopeFromSource } from "./source-enrichment.js";
import type { z } from "zod";

export function finalizeGenerationDraft(
  draft: StructuredDraftEnvelope,
  sourceText: string,
): StructuredDraftEnvelope {
  return enrichEnvelopeFromSource(draft, sourceText);
}

export function degradedDraftFromRaw<T extends z.ZodType>(input: {
  schema: T;
  rawExcerpt: string;
  parseIssues: string[];
  expectedKeys: readonly string[];
  toEnvelope: (fields: Record<string, string>) => StructuredDraftEnvelope;
}): StructuredDraftEnvelope | null {
  const { fields, issues } = tryPartialParse(input.schema, input.rawExcerpt);
  const mergedIssues = [...input.parseIssues, ...issues];
  const hasField = input.expectedKeys.some((k) => fields[k]?.trim());
  if (!hasField) return null;
  const draft = input.toEnvelope(fields);
  return {
    ...draft,
    status: "degraded",
    rawExcerpt: input.rawExcerpt,
    parseIssues: mergedIssues.length ? [...new Set(mergedIssues)] : input.parseIssues,
  };
}
