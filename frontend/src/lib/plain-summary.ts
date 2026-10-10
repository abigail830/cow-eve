function collapseInstructionText(text: string): string {
  return text
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** One-line preview for list rows (strip markdown noise). */
export function plainSummary(text: string, maxLength = 160): string {
  const collapsed = collapseInstructionText(text);
  if (!collapsed) return "";
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength).trim()}…`;
}

/** Shorter card blurb: drop redundant labels and cap length for dense grids. */
export function cardPreview(text: string, maxLength = 88): string {
  const collapsed = collapseInstructionText(text)
    .replace(/^项目[：:]\s*/u, "")
    .replace(/^project[：:]\s*/i, "");
  if (!collapsed) return "";
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength).trim()}…`;
}
