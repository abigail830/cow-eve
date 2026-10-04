import { normalizeRetrievePayload } from "./normalize-retrieve-json.js";
import {
  RetrieveResultSchema,
  type RetrieveResult,
} from "./research-schemas.js";

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return JSON.parse(fence[1].trim());
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("No JSON object found in retrieve subagent reply.");
}

function coerceRetrieveResult(
  raw: unknown,
  expectedSubQuestionId: string,
): RetrieveResult {
  let value: unknown = raw;
  if (typeof raw === "string") {
    value = extractJsonObject(raw);
  }
  value = normalizeRetrievePayload(value);
  const parsed = RetrieveResultSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Retrieve JSON did not match schema: ${parsed.error.message}`,
    );
  }
  const data = parsed.data;
  if (data.subQuestionId !== expectedSubQuestionId) {
    return { ...data, subQuestionId: expectedSubQuestionId };
  }
  return data;
}

export function parseRetrieveAgentResult(
  result: {
    data?: unknown;
    message?: string;
    status: string;
    error?: { message?: string };
  },
  expectedSubQuestionId: string,
): RetrieveResult {
  if (result.status === "failed") {
    throw new Error(result.error?.message ?? "Retrieve subagent failed.");
  }

  const candidates: unknown[] = [];
  if (result.data !== undefined) candidates.push(result.data);
  if (result.message?.trim()) candidates.push(result.message);

  let lastError: Error | undefined;
  for (const candidate of candidates) {
    try {
      return coerceRetrieveResult(candidate, expectedSubQuestionId);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  return {
    subQuestionId: expectedSubQuestionId,
    status: "blocked",
    findings: [],
    gaps: [
      lastError?.message ??
        "Retrieve subagent did not return valid JSON for this sub-question.",
    ],
    toolsUsed: { web: 0, kb: 0, hubspot: 0 },
  };
}
