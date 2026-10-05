import type { z } from "zod";

export function extractJsonObject(text: string): unknown {
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
  throw new Error("No JSON object found in model output.");
}

export function parseWithSchema<T extends z.ZodType>(
  schema: T,
  raw: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; issues: string[] } {
  if (typeof raw === "string") {
    try {
      raw = extractJsonObject(raw);
    } catch (err) {
      return {
        ok: false,
        issues: [err instanceof Error ? err.message : String(err)],
      };
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "root"}: ${i.message}`,
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export function truncateExcerpt(text: string, max = 2000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… [truncated]`;
}
