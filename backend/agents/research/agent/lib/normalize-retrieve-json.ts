import type { ResearchFinding } from "./research-schemas.js";

const CONFIDENCE_ALIASES: Record<string, ResearchFinding["confidence"]> = {
  high: "high",
  h: "high",
  med: "med",
  medium: "med",
  moderate: "med",
  m: "med",
  mid: "med",
  low: "low",
  l: "low",
  高: "high",
  中: "med",
  低: "low",
};

export function normalizeConfidence(value: unknown): ResearchFinding["confidence"] {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    const mapped = CONFIDENCE_ALIASES[key] ?? CONFIDENCE_ALIASES[value.trim()];
    if (mapped) return mapped;
  }
  return "med";
}

/** Coerce common LLM drift before Zod (medium → med, etc.) so findings are not dropped. */
export function normalizeRetrievePayload(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.findings)) return raw;

  const findings = obj.findings.map((item) => {
    if (item == null || typeof item !== "object") return item;
    const row = item as Record<string, unknown>;
    return {
      ...row,
      confidence: normalizeConfidence(row.confidence),
    };
  });

  return { ...obj, findings };
}
