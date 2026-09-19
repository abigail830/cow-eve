import { z } from "zod";

export const artifactKindSchema = z.enum([
  "proposal_preview",
  "proposal_document",
  "proposal_word",
  "diagram_svg",
  "slide_deck",
  "content_document",
]);

export const artifactFormatSchema = z.enum([
  "markdown",
  "docx",
  "svg",
  "slidev",
  "html",
  "pdf",
  "pptx",
]);

export const artifactSpecSchema = z.object({
  kind: artifactKindSchema,
  title: z.string(),
  format: artifactFormatSchema.default("markdown"),
  content: z.string(),
  filename: z.string(),
  artifact_id: z.string(),
  download_url: z.string().nullable().optional(),
  png_download_url: z.string().nullable().optional(),
  png_filename: z.string().nullable().optional(),
  pdf_download_url: z.string().nullable().optional(),
  pdf_filename: z.string().nullable().optional(),
  preview_url: z.string().nullable().optional(),
  preview_truncated: z.boolean().optional(),
  source: z.string().nullable().optional(),
});

export type ArtifactKind = z.infer<typeof artifactKindSchema>;
export type ArtifactFormat = z.infer<typeof artifactFormatSchema>;
export type ArtifactSpec = z.infer<typeof artifactSpecSchema>;

export const publishArtifactOutputSchema = artifactSpecSchema.extend({
  status: z.enum(["queued", "deduplicated", "error"]),
  queued: z.boolean().optional(),
  message: z.string().optional(),
});

export type PublishArtifactOutput = z.infer<typeof publishArtifactOutputSchema>;

export function artifactDownloadPath(chatId: string, artifactId: string, variant?: string): string {
  const base = `/api/chats/${chatId}/artifacts/${artifactId}`;
  return variant ? `${base}?format=${encodeURIComponent(variant)}` : base;
}

export function artifactPreviewPath(chatId: string, artifactId: string): string {
  return `/api/chats/${chatId}/artifacts/${artifactId}/preview`;
}
