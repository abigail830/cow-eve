/** Code-defined integration catalog (not per-user). User values live in user_integrations. */

export type IntegrationFieldKind = "secret" | "url" | "text";

export type IntegrationFieldDefinition = {
  key: string;
  kind: IntegrationFieldKind;
  label: string;
  description?: string;
  placeholder?: string;
  /** Shown in the UI when the user has not set a value (optional fields). */
  defaultValue?: string;
  required: boolean;
  /** Non-secret fields stored in user_integrations.config */
  storeInConfig?: boolean;
};

export type IntegrationAuthKind = "api_key" | "oauth";

export type IntegrationCredentialScope = "user" | "agent";

export type IntegrationDefinition = {
  id: string;
  name: string;
  description: string;
  docUrl: string;
  authKind: IntegrationAuthKind;
  /** Where credentials are stored. Default user (account-wide). */
  scope?: IntegrationCredentialScope;
  fields: readonly IntegrationFieldDefinition[];
};

export const INTEGRATION_ZHIPU_WEB_SEARCH = "zhipu_web_search";
export const INTEGRATION_HYBRID_SEARCH = "hybrid_search";
export const INTEGRATION_NOTION = "notion";
export const INTEGRATION_HUBSPOT = "hubspot";

export const INTEGRATION_CATALOG: readonly IntegrationDefinition[] = [
  {
    id: INTEGRATION_ZHIPU_WEB_SEARCH,
    name: "Zhipu Web Search",
    description:
      "Search the public web via Zhipu Coding Plan MCP (web_search_prime). Use when knowledge bases are insufficient or you need fresh information.",
    docUrl:
      "https://docs.bigmodel.cn/cn/coding-plan/mcp/search-mcp-server",
    authKind: "api_key",
    scope: "user",
    fields: [
      {
        key: "apiKey",
        kind: "secret",
        label: "API Key",
        description:
          "Coding Plan API key from 智谱开放平台 (personal or team plan). Stored without the Bearer prefix; the platform sends Authorization: Bearer <key> per Zhipu MCP docs.",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
        required: true,
      },
    ],
  },
  {
    id: INTEGRATION_HYBRID_SEARCH,
    name: "Hybrid Search (Knowledge)",
    description:
      "List knowledge bases and run hybrid retrieval for grounded Q&A (kb-qa skill).",
    docUrl: "https://cow-platform-ii.vercel.app",
    authKind: "api_key",
    scope: "user",
    fields: [
      {
        key: "mcpUrl",
        kind: "url",
        label: "MCP URL",
        description:
          "Hybrid search MCP endpoint. Edit only if you use a different OpenKMS host.",
        defaultValue:
          "https://cow-platform-ii.vercel.app/api/mcp/hybrid-search",
        storeInConfig: true,
        required: false,
      },
      {
        key: "apiKey",
        kind: "secret",
        label: "API Key",
        required: true,
      },
    ],
  },
  {
    id: INTEGRATION_NOTION,
    name: "Notion",
    description:
      "Connect Notion to search, read, and create workspace content via MCP.",
    docUrl: "https://developers.notion.com/guides/mcp/get-started-with-mcp",
    authKind: "oauth",
    scope: "agent",
    fields: [],
  },
  {
    id: INTEGRATION_HUBSPOT,
    name: "HubSpot",
    description: "Connect HubSpot CRM via remote MCP (OAuth).",
    docUrl: "https://developers.hubspot.com/mcp",
    authKind: "oauth",
    scope: "agent",
    fields: [],
  },
];

export function getIntegrationDefinition(
  id: string,
): IntegrationDefinition | undefined {
  return INTEGRATION_CATALOG.find((row) => row.id === id);
}
