export type GrepMatch = { line: number; text: string };

export function grepContent(
  content: string,
  pattern: string,
  options: { ignoreCase?: boolean; headLimit?: number } = {},
): GrepMatch[] {
  const ignoreCase = options.ignoreCase ?? true;
  const headLimit = options.headLimit ?? 50;
  if (!pattern.trim()) return [];
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, ignoreCase ? "i" : "");
  } catch {
    regex = new RegExp(
      pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      ignoreCase ? "i" : "",
    );
  }
  const lines = content.split("\n");
  const matches: GrepMatch[] = [];
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx] ?? "";
    if (!regex.test(line)) continue;
    matches.push({ line: idx + 1, text: line });
    if (matches.length >= headLimit) break;
  }
  return matches;
}
