import { z } from "zod";

export const DRAFT_DISCLAIMER =
  "Draft — verify against your evidence before use in the audit system.";

export const citationSchema = z.object({
  attachmentId: z.string().optional(),
  filename: z.string().optional(),
  excerpt: z.string().optional(),
});

export type Citation = z.infer<typeof citationSchema>;

export const structuredDraftSectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  body: z.string(),
  items: z.array(z.string()).optional(),
  artExclude: z.boolean().optional(),
  citations: z.array(citationSchema).optional(),
  flags: z.array(z.enum(["unsupported", "verify"])).optional(),
});

export type StructuredDraftSection = z.infer<typeof structuredDraftSectionSchema>;

export const structuredDraftEnvelopeSchema = z.object({
  version: z.literal(1),
  templateId: z.string(),
  title: z.string(),
  disclaimer: z.string(),
  status: z.enum(["ok", "degraded", "needs_input", "error"]),
  needsInput: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
  meta: z
    .object({
      language: z.string().optional(),
      standard: z.string().optional(),
      grade: z.string().optional(),
    })
    .optional(),
  sections: z.array(structuredDraftSectionSchema),
  artPayload: z.record(z.string(), z.unknown()).optional(),
  rawExcerpt: z.string().optional(),
  parseIssues: z.array(z.string()).optional(),
  unsupported: z
    .array(
      z.object({
        sectionId: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
});

export type StructuredDraftEnvelope = z.infer<typeof structuredDraftEnvelopeSchema>;

export const generationToolResultSchema = z.object({
  status: z.enum(["ok", "degraded", "needs_input", "error"]),
  draft: structuredDraftEnvelopeSchema.optional(),
  rawExcerpt: z.string().optional(),
  parseIssues: z.array(z.string()).optional(),
  message: z.string().optional(),
});

export type GenerationToolResult = z.infer<typeof generationToolResultSchema>;

export function draftToMarkdown(draft: StructuredDraftEnvelope): string {
  const lines: string[] = [draft.disclaimer, "", `## ${draft.title}`, ""];
  if (draft.status === "degraded") {
    lines.push(
      "*Some fields could not be parsed; review carefully.*",
      "",
    );
  }
  for (const section of draft.sections) {
    lines.push(`### ${section.label}`, "");
    if (section.items?.length) {
      for (const item of section.items) {
        lines.push(`- ${item}`);
      }
    } else {
      lines.push(section.body.trim() || "—");
    }
    if (section.flags?.includes("verify")) {
      lines.push("", "*(verify)*");
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function buildEnvelope(input: {
  templateId: string;
  title: string;
  status: StructuredDraftEnvelope["status"];
  sections: StructuredDraftSection[];
  artPayload?: Record<string, unknown>;
  needsInput?: { code: string; message: string };
  meta?: StructuredDraftEnvelope["meta"];
  rawExcerpt?: string;
  parseIssues?: string[];
}): StructuredDraftEnvelope {
  return {
    version: 1,
    templateId: input.templateId,
    title: input.title,
    disclaimer: DRAFT_DISCLAIMER,
    status: input.status,
    needsInput: input.needsInput,
    meta: input.meta,
    sections: input.sections,
    artPayload: input.artPayload,
    rawExcerpt: input.rawExcerpt,
    parseIssues: input.parseIssues,
  };
}
