export function getHybridSearchMcpUrl(): string | null {
  const url = process.env.HYBRID_SEARCH_MCP_URL?.trim();
  return url || null;
}

export function getHybridSearchApiKey(): string | null {
  const key = process.env.HYBRID_SEARCH_API_KEY?.trim();
  return key || null;
}

export function getZhipuWebSearchMcpUrl(): string | null {
  const url = process.env.ZHIPU_WEB_SEARCH_MCP_URL?.trim();
  return (
    url || "https://open.bigmodel.cn/api/mcp/web_search_prime/mcp"
  );
}

export function getZhipuApiKey(): string | null {
  const key = process.env.ZHIPU_API_KEY?.trim();
  return key || null;
}

export function getNotionMcpUrl(): string {
  return process.env.NOTION_MCP_URL?.trim() || "https://mcp.notion.com/mcp";
}
