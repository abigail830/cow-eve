import dns from "node:dns";
import {
  getHybridSearchApiBase,
  normalizeHybridSearchApiKey,
} from "../config/mcp.config.js";

/** Prefer IPv4 when both A and AAAA exist (avoids some local "fetch failed" cases). */
dns.setDefaultResultOrder("ipv4first");

/** Align with agent-platform `MCP_HTTP_REQUEST_TIMEOUT` default (seconds). */
const KB_LIST_TIMEOUT_MS = 60_000;

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

/**
 * OpenKMS management API — same host as hybrid-search MCP, different path.
 * MCP (agent tools): `{base}/api/mcp/hybrid-search`
 * KB list (UI):       `{base}/api/knowledge/knowledge-bases`
 * Both use `Authorization: Bearer okf_…` (see agent-platform `kb_client.py`).
 */
export async function listVisibleKnowledgeBases(input: {
  apiKey: string;
}): Promise<KnowledgeBaseListItem[]> {
  const apiKey = normalizeHybridSearchApiKey(input.apiKey);
  if (!apiKey) {
    throw new HybridSearchKbClientError("Hybrid Search API key is missing");
  }

  const base = getHybridSearchApiBase();
  if (!base) {
    throw new HybridSearchKbClientError(
      "Hybrid Search API base URL is not configured (set HYBRID_SEARCH_MCP_URL or HYBRID_SEARCH_API_BASE)",
    );
  }

  const url = `${base}/api/knowledge/knowledge-bases`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      redirect: "follow",
      signal: AbortSignal.timeout(KB_LIST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new HybridSearchKbClientError(
      `Failed to reach knowledge-base API: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (response.status === 401) {
    throw new HybridSearchKbClientError(
      "Hybrid Search API key is invalid",
      401,
    );
  }
  if (response.status === 403) {
    throw new HybridSearchKbClientError(
      "Hybrid Search API key cannot list knowledge bases",
      403,
    );
  }
  if (response.status >= 400) {
    throw new HybridSearchKbClientError(
      `Knowledge-base API returned HTTP ${response.status}`,
      response.status,
    );
  }

  const payload = (await response.json()) as unknown;
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
        typeof record.item_count === "number" ? item.item_count : null,
      is_configured:
        typeof record.is_configured === "boolean"
          ? record.is_configured
          : null,
    });
  }
  return out;
}
