const GIST_OUTPUT_EXAMPLE =
  '{"abstract": "Example document summary in 1–2 sentences.", "tags": ["keyword", "topic"]}';

export const GIST_SYSTEM_INSTRUCTIONS = [
  "You extract attachment metadata for keyword search in a chat document library.",
  "Output rules:",
  "1. Reply with exactly one JSON object — no prose before/after, no ``` fences.",
  '2. Required keys: "abstract" (string), "tags" (array of strings).',
  "3. abstract: 1–2 sentences summarizing what the document is about; match the document's language.",
  "4. tags: 1–8 short keywords or phrases.",
].join("\n");

export function truncateMarkdownForGist(content: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  if (content.length <= maxChars) return content;
  const marker = "\n\n[… truncated …]\n\n";
  if (maxChars <= marker.length + 20) return content.slice(0, maxChars);
  const head = Math.floor((maxChars - marker.length) / 2);
  const tail = maxChars - marker.length - head;
  return `${content.slice(0, head)}${marker}${content.slice(-tail)}`;
}

export function sectionTitlesFromMeta(
  meta: Record<string, unknown> | null,
  limit = 5,
): string[] {
  if (!meta) return [];
  const sections = meta.sections;
  if (!Array.isArray(sections)) return [];
  const titles: string[] = [];
  for (const section of sections.slice(0, limit)) {
    if (typeof section !== "object" || !section) continue;
    const title = String((section as { title?: string }).title ?? "").trim();
    if (title) titles.push(title);
  }
  return titles;
}

export function buildGistUserPrompt(input: {
  filename: string;
  mimeType: string;
  markdown: string;
  sectionTitles?: readonly string[];
}): string {
  const parts = [
    `Filename: ${input.filename}`,
    `MIME type: ${input.mimeType}`,
  ];
  if (input.sectionTitles?.length) {
    parts.push(`Section headings: ${JSON.stringify([...input.sectionTitles])}`);
  }
  parts.push("Document:", "---", input.markdown, "---");
  parts.push(
    "Task: extract search metadata for this document.",
    "Rules:",
    "- abstract: 1–2 sentences; same primary language as the document.",
    "- tags: JSON array of 1–8 short keywords or phrases.",
    "- Output: one JSON object only, same keys as the example.",
    `Example shape: ${GIST_OUTPUT_EXAMPLE}`,
  );
  return parts.join("\n");
}
