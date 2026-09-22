export type MentionState = {
  /** Index of `@` in the textarea value. */
  start: number;
  query: string;
  selectedIndex: number;
};

/** Active `@` mention at the cursor, if any. */
export function getMentionAtCursor(
  text: string,
  cursor: number,
): Omit<MentionState, "selectedIndex"> | null {
  const before = text.slice(0, cursor);
  const match = before.match(/(^|[\s([{"'])@([^\s@]*)$/);
  if (!match || match.index === undefined) return null;
  const query = match[2] ?? "";
  const start = before.length - query.length - 1;
  return { start, query };
}

export function insertMentionFilename(
  text: string,
  mention: Pick<MentionState, "start" | "query">,
  cursor: number,
  filename: string,
): { nextText: string; nextCursor: number } {
  const beforeAt = text.slice(0, mention.start);
  const afterQuery = text.slice(cursor);
  const insert = `@${filename} `;
  const nextText = beforeAt + insert + afterQuery;
  const nextCursor = beforeAt.length + insert.length;
  return { nextText, nextCursor };
}

export function formatMentionTimestamp(iso: string | null): string {
  if (!iso) return "Unsent";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}
