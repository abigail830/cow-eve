import { generateObject, generateText } from "ai";
import type { z } from "zod";
import { loadPlatformChatModel } from "./platform-chat-model.js";
import {
  extractJsonObject,
  parseWithSchema,
  truncateExcerpt,
} from "./parse-generation-json.js";
import {
  CLIENT_PROPOSAL_EXTRACTION_TEMPLATE,
  fillNovaTemplate,
} from "./prompts/nova-verbatim-templates.js";

export async function runStructuredGeneration<T extends z.ZodType>(input: {
  system: string;
  user: string;
  schema: T;
  repairHint?: string;
}): Promise<
  | { ok: true; data: z.infer<T>; raw: string }
  | { ok: false; issues: string[]; rawExcerpt: string }
> {
  const model = await loadPlatformChatModel();
  let lastRaw = "";
  let lastIssues: string[] = [];
  let userPrompt = input.user;
  const repairHint =
    input.repairHint ??
    "Return valid JSON with double quotes and exactly the required keys.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { object } = await generateObject({
        model,
        schema: input.schema,
        system: input.system,
        prompt: attempt === 0 ? userPrompt : `${userPrompt}\n\n${repairHint}`,
      });
      return { ok: true, data: object as z.infer<T>, raw: JSON.stringify(object) };
    } catch (err) {
      lastRaw = err instanceof Error ? err.message : String(err);
    }

    try {
      const { text } = await generateText({
        model,
        system: input.system,
        prompt: userPrompt,
      });
      lastRaw = text;
      const parsed = parseWithSchema(input.schema, text);
      if (parsed.ok) {
        return { ok: true, data: parsed.data, raw: text };
      }
      lastIssues = parsed.issues;
      userPrompt = `${input.user}\n\nYour previous output failed validation:\n${parsed.issues.join("\n")}\nReturn ONLY JSON matching the required keys.`;
    } catch (fallbackErr) {
      lastRaw =
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      lastIssues = [lastRaw];
    }
  }

  try {
    const parsed = parseWithSchema(input.schema, lastRaw);
    if (parsed.ok) {
      return { ok: true, data: parsed.data, raw: lastRaw };
    }
    lastIssues = parsed.issues;
  } catch {
    /* keep lastIssues */
  }

  return {
    ok: false,
    issues: lastIssues.length ? lastIssues : ["Model did not return valid JSON."],
    rawExcerpt: truncateExcerpt(lastRaw),
  };
}

export async function runClientPlanExtract(text: string): Promise<
  | { present: true; summary: string }
  | { present: false }
> {
  const model = await loadPlatformChatModel();
  const prompt = fillNovaTemplate(CLIENT_PROPOSAL_EXTRACTION_TEMPLATE, { text });
  const { text: out } = await generateText({
    model,
    prompt,
  });
  const trimmed = out.trim();
  if (!trimmed || trimmed === "NOT_FOUND") {
    return { present: false };
  }
  try {
    const raw = extractJsonObject(trimmed);
    if (
      raw &&
      typeof raw === "object" &&
      "present" in raw &&
      (raw as { present: boolean }).present === false
    ) {
      return { present: false };
    }
    const summary =
      raw &&
      typeof raw === "object" &&
      "summary" in raw &&
      typeof (raw as { summary: unknown }).summary === "string"
        ? (raw as { summary: string }).summary
        : trimmed;
    if (!summary || summary === "NOT_FOUND") return { present: false };
    return { present: true, summary };
  } catch {
    if (trimmed === "NOT_FOUND") return { present: false };
    return { present: true, summary: trimmed };
  }
}
