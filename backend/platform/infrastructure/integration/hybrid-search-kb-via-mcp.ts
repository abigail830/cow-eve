import { createMCPClient } from "@ai-sdk/mcp";
import {
  getHybridSearchMcpUrl,
  normalizeHybridSearchApiKey,
  resolveFirstHttpUrl,
} from "../config/mcp.config.js";
import {
  HybridSearchKbClientError,
  parseKnowledgeBaseItemsPayload,
  type KnowledgeBaseListItem,
} from "./hybrid-search-kb.types.js";

function parseCallToolPayload(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  const record = result as Record<string, unknown>;
  const content = record.content;
  if (!Array.isArray(content)) return result;
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const block = part as Record<string, unknown>;
    if (block.type === "text" && typeof block.text === "string") {
      const text = block.text.trim();
      if (!text) continue;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    }
  }
  return result;
}

/** Same data as REST list, via hybrid-search MCP `list_knowledge_bases` (Eve uses this path). */
export async function listVisibleKnowledgeBasesViaMcp(input: {
  apiKey: string;
  mcpUrl?: string | null;
}): Promise<KnowledgeBaseListItem[]> {
  const apiKey = normalizeHybridSearchApiKey(input.apiKey);
  const mcpUrl = resolveFirstHttpUrl(input.mcpUrl, getHybridSearchMcpUrl());
  if (!apiKey) {
    throw new HybridSearchKbClientError("Hybrid Search API key is missing");
  }
  if (!mcpUrl) {
    throw new HybridSearchKbClientError("Hybrid Search MCP URL is not configured");
  }

  let client: Awaited<ReturnType<typeof createMCPClient>> | null = null;
  try {
    client = await createMCPClient({
      transport: {
        type: "http",
        url: mcpUrl,
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    });
    const toolResult = await client.callTool({
      name: "list_knowledge_bases",
      arguments: {},
    });
    const payload = parseCallToolPayload(toolResult);
    return parseKnowledgeBaseItemsPayload(payload);
  } catch (err) {
    throw new HybridSearchKbClientError(
      `MCP list_knowledge_bases failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    await client?.close().catch(() => undefined);
  }
}
