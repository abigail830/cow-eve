/** One-line preview for list rows (strip markdown noise). */
export function plainSummary(text: string, maxLength = 160): string {
  const collapsed = text
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsed) return "";
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength).trim()}…`;
}
