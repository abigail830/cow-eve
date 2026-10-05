import { extractJsonObject, parseWithSchema } from "./parse-generation-json.js";
import type { z } from "zod";

export function pickStringFields(raw: unknown): Record<string, string> {
  if (typeof raw === "string") {
    try {
      raw = extractJsonObject(raw);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

export function tryPartialParse<T extends z.ZodType>(
  schema: T,
  rawText: string,
): { fields: Record<string, string>; issues: string[] } {
  const issues: string[] = [];
  let fields: Record<string, string> = {};
  try {
    const obj = extractJsonObject(rawText);
    fields = pickStringFields(obj);
    const parsed = parseWithSchema(schema, obj);
    if (!parsed.ok) {
      issues.push(...parsed.issues);
    }
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err));
  }
  return { fields, issues };
}
