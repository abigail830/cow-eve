export type AttachmentGistMetadata = {
  abstract: string;
  tags: readonly string[];
};

function stripJsonFence(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "");
    text = text.replace(/\s*```$/, "");
  }
  return text.trim();
}

function extractJsonObject(raw: string): string {
  const text = stripJsonFence(raw);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function normalizeTags(tagsRaw: unknown): string[] {
  const tags: string[] = [];
  if (typeof tagsRaw === "string") {
    for (const part of tagsRaw.split(/[,;|]/)) {
      const piece = part.trim();
      if (piece) tags.push(piece);
    }
    return tags;
  }
  if (Array.isArray(tagsRaw)) {
    for (const item of tagsRaw) {
      if (typeof item === "string" && item.trim()) tags.push(item.trim());
    }
  }
  return tags;
}

export function parseGistMetadata(raw: string): AttachmentGistMetadata | null {
  try {
    const payload = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
    const abstract = payload.abstract;
    if (typeof abstract !== "string" || !abstract.trim()) return null;
    let tags = normalizeTags(payload.tags);
    if (tags.length > 8) tags = tags.slice(0, 8);
    return { abstract: abstract.trim(), tags };
  } catch {
    return null;
  }
}

export function gistMetadataToText(
  metadata: AttachmentGistMetadata,
  maxLen = 2000,
): string {
  const abstract = metadata.abstract.trim();
  const tagPart = metadata.tags.filter((t) => t.trim()).join(", ");
  const text = tagPart
    ? abstract
      ? `${abstract} | ${tagPart}`
      : tagPart
    : abstract;
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}
