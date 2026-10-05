import { z } from "zod";

export const structuredDraftSectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  body: z.string(),
  items: z.array(z.string()).optional(),
  artExclude: z.boolean().optional(),
  citations: z
    .array(
      z.object({
        attachmentId: z.string().optional(),
        filename: z.string().optional(),
        excerpt: z.string().optional(),
      }),
    )
    .optional(),
  flags: z.array(z.enum(["unsupported", "verify"])).optional(),
});

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
  meta: z.record(z.string(), z.string()).optional(),
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

export const generationToolResultSchema = z.object({
  status: z.enum(["ok", "degraded", "needs_input", "error"]),
  draft: structuredDraftEnvelopeSchema.optional(),
  message: z.string().optional(),
  rawExcerpt: z.string().optional(),
  parseIssues: z.array(z.string()).optional(),
});

export type StructuredDraftSection = z.infer<typeof structuredDraftSectionSchema>;
export type StructuredDraftEnvelope = z.infer<typeof structuredDraftEnvelopeSchema>;
