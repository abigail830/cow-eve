import type { ArtifactSpec } from "@fde/artifact-spec";

export type ArtifactCardType =
  | "diagram"
  | "html"
  | "word"
  | "ppt"
  | "markdown"
  | "generic";

export function isDiagramArtifact(spec: ArtifactSpec): boolean {
  return spec.kind === "diagram_svg";
}

export function isSlideDeckArtifact(spec: ArtifactSpec): boolean {
  return spec.kind === "slide_deck";
}

export function isContentDocumentArtifact(spec: ArtifactSpec): boolean {
  return spec.kind === "content_document";
}

function contentFormat(spec: ArtifactSpec): string {
  return (spec.format || "").toLowerCase();
}

function contentFilename(spec: ArtifactSpec): string {
  return (spec.filename || "").toLowerCase();
}

export function isWordArtifact(spec: ArtifactSpec): boolean {
  const format = contentFormat(spec);
  const name = contentFilename(spec);
  return format === "docx" || name.endsWith(".docx") || spec.kind === "proposal_word";
}

export function isPptArtifact(spec: ArtifactSpec): boolean {
  const format = contentFormat(spec);
  const name = contentFilename(spec);
  return format === "pptx" || name.endsWith(".pptx");
}

export function isHtmlArtifact(spec: ArtifactSpec): boolean {
  if (isSlideDeckArtifact(spec)) return contentFormat(spec) === "html";
  const format = contentFormat(spec);
  const name = contentFilename(spec);
  return format === "html" || name.endsWith(".html");
}

export function isMarkdownPreviewable(spec: ArtifactSpec): boolean {
  if (!isContentDocumentArtifact(spec)) return false;
  const format = contentFormat(spec);
  const name = contentFilename(spec);
  return format === "markdown" || format === "md" || name.endsWith(".md");
}

/** Route spec to the dedicated inline card variant. */
export function resolveArtifactCardType(spec: ArtifactSpec): ArtifactCardType {
  if (isDiagramArtifact(spec)) return "diagram";
  if (isSlideDeckArtifact(spec)) return "html";
  if (isWordArtifact(spec)) return "word";
  if (isPptArtifact(spec)) return "ppt";
  if (isMarkdownPreviewable(spec)) return "markdown";
  if (isHtmlArtifact(spec)) return "html";
  return "generic";
}

export function canPreviewArtifact(spec: ArtifactSpec): boolean {
  if (isSlideDeckArtifact(spec) && spec.preview_url) return true;
  if (isDiagramArtifact(spec)) return Boolean(spec.content?.trim() || spec.download_url);
  if (isMarkdownPreviewable(spec)) {
    return Boolean(spec.content?.trim() || spec.download_url?.trim());
  }
  if (isWordArtifact(spec) || isPptArtifact(spec)) {
    return Boolean(spec.download_url?.trim());
  }
  return false;
}

const FORMAT_LABELS: Record<string, string> = {
  html: "HTML",
  slidev: "Slidev",
  markdown: "Markdown",
  docx: "Word",
  pptx: "PowerPoint",
  pdf: "PDF",
  svg: "SVG",
};

export function artifactCardSubtitle(spec: ArtifactSpec): string {
  const formatLabel = FORMAT_LABELS[spec.format] ?? spec.format.toUpperCase();
  if (isSlideDeckArtifact(spec)) return `Slides · ${formatLabel}`;
  if (isDiagramArtifact(spec)) return `Diagram · ${formatLabel}`;
  if (isContentDocumentArtifact(spec)) return `Document · ${formatLabel}`;
  return formatLabel;
}
