import { getFrontendOrigins } from "./env.config.js";
import { getJwtSecret } from "./env.config.js";
import { resolveIntegrationOAuthRedirectUri } from "./oauth-redirect-uri.js";

export function getIntegrationOAuthStateSecret(): string {
  const explicit = process.env.INTEGRATION_OAUTH_STATE_SECRET?.trim();
  if (explicit && explicit.length >= 16) return explicit;
  return getJwtSecret();
}

export function getIntegrationSuccessRedirectBase(): string {
  const explicit = process.env.INTEGRATION_SUCCESS_REDIRECT?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return getFrontendOrigins()[0] ?? "http://127.0.0.1:5273";
}

export function getNotionMcpOAuthConfig(): {
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
} {
  return {
    clientId: process.env.NOTION_MCP_CLIENT_ID?.trim() || null,
    clientSecret: process.env.NOTION_MCP_CLIENT_SECRET?.trim() || null,
    redirectUri: resolveIntegrationOAuthRedirectUri({
      integrationId: "notion",
      envRedirectUri: process.env.NOTION_MCP_REDIRECT_URI,
    }),
  };
}

export function getHubspotMcpOAuthConfig(): {
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
} {
  return {
    clientId: process.env.HUBSPOT_MCP_CLIENT_ID?.trim() || null,
    clientSecret: process.env.HUBSPOT_MCP_CLIENT_SECRET?.trim() || null,
    redirectUri: resolveIntegrationOAuthRedirectUri({
      integrationId: "hubspot",
      envRedirectUri: process.env.HUBSPOT_MCP_REDIRECT_URI,
    }),
  };
}

export function getFeishuOAuthConfig(): {
  appId: string | null;
  appSecret: string | null;
  redirectUri: string | null;
} {
  return {
    appId: process.env.FEISHU_APP_ID?.trim() || null,
    appSecret: process.env.FEISHU_APP_SECRET?.trim() || null,
    redirectUri: resolveIntegrationOAuthRedirectUri({
      integrationId: "feishu",
      envRedirectUri: process.env.FEISHU_OAUTH_REDIRECT_URI,
    }),
  };
}
