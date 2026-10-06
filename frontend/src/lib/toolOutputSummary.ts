import { extractToolErrorText } from "./researchWorkflowStaleHint";

const MAX_OUTCOME_LEN = 88;

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const GENERIC_OUTCOMES = new Set(["Completed.", "Completed successfully."]);

export function isGenericToolOutcome(text: string): boolean {
  return GENERIC_OUTCOMES.has(text.trim());
}

function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim())?.trim() ?? text.trim();
}

function summarizeArray(items: unknown[]): string | null {
  if (items.length === 0) return "No results";
  if (items.length === 1) {
    const one = summarizeValue(items[0]);
    return one ?? "1 result";
  }
  return `${items.length} results`;
}

function summarizeValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const line = firstLine(value);
    if (!line) return null;
    if (line.startsWith("{") || line.startsWith("[")) return null;
    return truncate(line, MAX_OUTCOME_LEN);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return summarizeArray(value);
  if (typeof value === "object") {
    return summarizeStructuredOutput(value);
  }
  return null;
}

function summarizeStructuredOutput(output: unknown): string | null {
  if (output == null) return null;

  if (Array.isArray(output)) return summarizeArray(output);

  if (typeof output !== "object") {
    return summarizeValue(output);
  }

  const record = output as Record<string, unknown>;

  if (typeof record.error === "string" && record.error.trim()) {
    return truncate(extractToolErrorText(output).trim(), MAX_OUTCOME_LEN);
  }

  for (const key of ["summary", "message", "result", "content", "text"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return truncate(firstLine(value), MAX_OUTCOME_LEN);
    }
  }

  for (const key of [
    "results",
    "items",
    "data",
    "hits",
    "documents",
    "chunks",
    "records",
    "connections",
  ]) {
    const value = record[key];
    if (Array.isArray(value)) {
      const label = key.replace(/_/g, " ");
      if (value.length === 0) return `No ${label}`;
      if (value.length === 1) {
        const inner = summarizeValue(value[0]);
        return inner ?? `1 ${label.replace(/s$/, "")}`;
      }
      return `${value.length} ${label}`;
    }
  }

  if (typeof record.count === "number") {
    return `${record.count} item${record.count === 1 ? "" : "s"}`;
  }
  if (typeof record.total === "number") {
    return `${record.total} total`;
  }

  if (Array.isArray(record.content)) {
    const texts = record.content
      .map((block) => {
        if (block == null || typeof block !== "object") return null;
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") return b.text;
        return null;
      })
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0);
    if (texts.length > 0) {
      return truncate(firstLine(texts.join(" ")), MAX_OUTCOME_LEN);
    }
  }

  if (record.ok === true) return "Completed successfully.";
  const status =
    typeof record.status === "string" ? record.status.toLowerCase() : "";
  if (status === "ok" || status === "success") {
    return "Completed successfully.";
  }

  return null;
}

/** Short outcome phrase for the tool step title (English UI). */
export function toolOutputOutcomeSummary(output: unknown): string | null {
  const summary = summarizeStructuredOutput(output);
  if (summary == null) return null;
  if (isGenericToolOutcome(summary)) return null;
  return summary;
}
