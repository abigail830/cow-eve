export class HybridSearchKbClientError extends Error {
  statusCode: number | null;

  constructor(message: string, statusCode: number | null = null) {
    super(message);
    this.name = "HybridSearchKbClientError";
    this.statusCode = statusCode;
  }
}

export type KnowledgeBaseListItem = {
  id: string;
  name: string;
  description?: string | null;
  type?: string | null;
  item_count?: number | null;
  is_configured?: boolean | null;
};

export function parseKnowledgeBaseItemsPayload(
  payload: unknown,
): KnowledgeBaseListItem[] {
  const items =
    payload && typeof payload === "object" && "items" in payload
      ? (payload as { items?: unknown }).items
      : payload;
  if (!Array.isArray(items)) return [];

  const out: KnowledgeBaseListItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const kbId = String(record.id ?? "").trim();
    if (!kbId) continue;
    out.push({
      id: kbId,
      name: String(record.name ?? kbId),
      description:
        typeof record.description === "string" ? record.description : null,
      type: typeof record.type === "string" ? record.type : null,
      item_count:
        typeof record.item_count === "number" ? record.item_count : null,
      is_configured:
        typeof record.is_configured === "boolean"
          ? record.is_configured
          : null,
    });
  }
  return out;
}
