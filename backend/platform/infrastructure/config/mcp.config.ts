const HYBRID_SEARCH_MCP_SUFFIX = "/api/mcp/hybrid-search";

/** Platform default when env and user config omit MCP URL (see Integrations copy). */
export const DEFAULT_HYBRID_SEARCH_MCP_URL =
  "https://cow-platform-ii.vercel.app/api/mcp/hybrid-search";

/** Bare email / login strings must not become `https://user@host` MCP URLs. */
function looksLikeBareEmailOrLogin(value: string): boolean {
  if (/^https?:\/\//i.test(value)) return false;
  return /^[^\s/]+@[^\s/]+\.[^\s/]+/.test(value);
}

export function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (looksLikeBareEmailOrLogin(trimmed)) return null;

  const candidates = trimmed.includes("://")
    ? [trimmed]
    : [trimmed, `https://${trimmed}`];

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }
      if (!parsed.hostname) continue;
      return parsed.href.replace(/\/+$/, "") || null;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** First valid http(s) URL among candidates. */
export function resolveFirstHttpUrl(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const normalized = normalizeHttpUrl(value);
    if (normalized) return normalized;
  }
  return null;
}

export function getHybridSearchMcpUrl(): string | null {
  const fromEnv = process.env.HYBRID_SEARCH_MCP_URL?.trim();
  return (
    resolveFirstHttpUrl(fromEnv, DEFAULT_HYBRID_SEARCH_MCP_URL) ?? null
  );
}

export function normalizeHybridSearchApiKey(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  let key = raw.trim();
  if (/^bearer\s+/i.test(key)) {
    key = key.replace(/^bearer\s+/i, "").trim();
  }
  return key || null;
}

export function getHybridSearchApiKey(): string | null {
  return normalizeHybridSearchApiKey(process.env.HYBRID_SEARCH_API_KEY);
}

/**
 * OpenKMS HTTP base for KB list (`/api/knowledge/knowledge-bases`).
 * Matches agent-platform `resolve_hybrid_search_api_base`: server env only
 * (HYBRID_SEARCH_API_BASE or HYBRID_SEARCH_MCP_URL), not per-user Integrations MCP URL.
 */
export function resolveHybridSearchApiBase(
  mcpUrlHint?: string | null,
): string | null {
  const explicit = process.env.HYBRID_SEARCH_API_BASE?.trim();
  if (explicit) {
    return normalizeHttpUrl(explicit)?.replace(/\/+$/, "") ?? null;
  }

  const mcp = resolveFirstHttpUrl(
    mcpUrlHint ?? process.env.HYBRID_SEARCH_MCP_URL,
    DEFAULT_HYBRID_SEARCH_MCP_URL,
  )?.replace(/\/+$/, "");
  if (!mcp) return null;
  if (mcp.endsWith(HYBRID_SEARCH_MCP_SUFFIX)) {
    const base = mcp
      .slice(0, -HYBRID_SEARCH_MCP_SUFFIX.length)
      .replace(/\/+$/, "");
    return base || null;
  }
  try {
    const parsed = new URL(mcp);
    if (parsed.protocol && parsed.host) {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function getHybridSearchApiBase(): string | null {
  return resolveHybridSearchApiBase(process.env.HYBRID_SEARCH_MCP_URL);
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

/** HubSpot remote MCP (Streamable HTTP) — see HubSpot MCP auth app docs. */
export function normalizeHubspotMcpUrl(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "https://mcp.hubspot.com";
  let url = trimmed.replace(/\/+$/, "") || trimmed;
  if (url.endsWith("/mcp")) {
    url = url.slice(0, -"/mcp".length).replace(/\/+$/, "") || "https://mcp.hubspot.com";
  }
  return url;
}

export function getHubspotMcpUrl(): string {
  return normalizeHubspotMcpUrl(process.env.HUBSPOT_MCP_URL);
}

const PROPOSAL_CATALOG_MCP_SUFFIX = "/api/mcp/catalog/mcp";
const PROPOSAL_CV_MCP_SUFFIX = "/api/mcp/cv/mcp";

export function getProposalCatalogMcpUrl(): string | null {
  const fromEnv = process.env.PROPOSAL_CATALOG_MCP_URL?.trim();
  return resolveFirstHttpUrl(fromEnv) ?? null;
}

export function getProposalCvMcpUrl(): string | null {
  const fromEnv = process.env.PROPOSAL_CV_MCP_URL?.trim();
  return resolveFirstHttpUrl(fromEnv) ?? null;
}

export function normalizeProposalKnowledgeApiKey(
  raw: string | null | undefined,
): string | null {
  return normalizeHybridSearchApiKey(raw);
}

export function getProposalKnowledgeApiKey(): string | null {
  return normalizeProposalKnowledgeApiKey(
    process.env.PROPOSAL_KNOWLEDGE_API_KEY,
  );
}

export { PROPOSAL_CATALOG_MCP_SUFFIX, PROPOSAL_CV_MCP_SUFFIX };
