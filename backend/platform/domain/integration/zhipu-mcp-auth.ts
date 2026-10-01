/**
 * Zhipu Coding Plan MCP (web_search_prime) expects:
 *   Authorization: Bearer YOUR_API_KEY
 * See https://docs.bigmodel.cn/cn/coding-plan/mcp/search-mcp-server
 */
export function zhipuMcpAuthorizationHeader(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (!trimmed) return "";
  if (/^bearer\s+/i.test(trimmed)) {
    return trimmed.replace(/^bearer\s+/i, "Bearer ");
  }
  return `Bearer ${trimmed}`;
}
