import dns from "node:dns";
import { Agent, fetch as undiciFetch } from "undici";
import {
  getHybridSearchApiBase,
  normalizeHybridSearchApiKey,
} from "../config/mcp.config.js";
import { listVisibleKnowledgeBasesViaMcp } from "./hybrid-search-kb-via-mcp.js";
import {
  HybridSearchKbClientError,
  parseKnowledgeBaseItemsPayload,
  type KnowledgeBaseListItem,
} from "./hybrid-search-kb.types.js";

export {
  HybridSearchKbClientError,
  type KnowledgeBaseListItem,
} from "./hybrid-search-kb.types.js";

dns.setDefaultResultOrder("ipv4first");

const CONNECT_TIMEOUT_MS = 20_000;
const READ_TIMEOUT_MS = 45_000;

const kbListDispatcher = new Agent({
  connectTimeout: CONNECT_TIMEOUT_MS,
  headersTimeout: READ_TIMEOUT_MS,
  bodyTimeout: READ_TIMEOUT_MS,
});

async function listVisibleKnowledgeBasesRest(input: {
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
  let response;
  try {
    response = await undiciFetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      redirect: "follow",
      dispatcher: kbListDispatcher,
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
  return parseKnowledgeBaseItemsPayload(payload);
}

/**
 * MCP first (same transport as Eve chat — often works when local REST to Vercel is slow),
 * then REST (agent-platform `kb_client.py`) as fallback.
 */
export async function listVisibleKnowledgeBases(input: {
  apiKey: string;
  hybridSearchMcpUrl?: string | null;
}): Promise<KnowledgeBaseListItem[]> {
  let mcpErr: HybridSearchKbClientError | null = null;
  try {
    return await listVisibleKnowledgeBasesViaMcp({
      apiKey: input.apiKey,
      mcpUrl: input.hybridSearchMcpUrl,
    });
  } catch (err) {
    mcpErr =
      err instanceof HybridSearchKbClientError
        ? err
        : new HybridSearchKbClientError(
            err instanceof Error ? err.message : String(err),
          );
    if (mcpErr.statusCode === 401 || mcpErr.statusCode === 403) {
      throw mcpErr;
    }
  }

  try {
    return await listVisibleKnowledgeBasesRest(input);
  } catch (restErr) {
    throw mcpErr ?? restErr;
  }
}
