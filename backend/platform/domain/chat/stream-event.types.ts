export type PersistableEvent = {
  meta: { id: string; at: string | Date };
  type: string;
  data?: unknown;
};

export function titleFromMessage(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "New chat";
  return compact.length <= 40 ? compact : `${compact.slice(0, 40)}…`;
}
