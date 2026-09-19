export type PersistableEvent = {
  meta: { id: string; at: string | Date };
  type: string;
  data?: unknown;
};

export const SKIP_PERSIST_EVENT_TYPES = new Set([
  "message.appended",
  "reasoning.appended",
  "action.partial",
  "action.input_appended",
  "subagent.child_event",
]);

export function titleFromMessage(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "New chat";
  return compact.length <= 40 ? compact : `${compact.slice(0, 40)}…`;
}
