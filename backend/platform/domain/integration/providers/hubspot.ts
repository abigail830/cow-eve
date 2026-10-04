import type { OAuthTokenBundle } from "../oauth/types.js";
import { getHubspotMcpOAuthConfig } from "../../../infrastructure/config/integration-oauth.config.js";

export const INTEGRATION_HUBSPOT = "hubspot";

const HUBSPOT_RESOURCE = "https://mcp.hubspot.com";
const HUBSPOT_AUTHORIZE_URL = "https://mcp.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL = "https://mcp.hubspot.com/oauth/v3/token";

export function hubspotMcpUrl(): string {
  const fromEnv = process.env.HUBSPOT_MCP_URL?.trim();
  return fromEnv || "https://mcp.hubspot.com/mcp";
}

export function isHubspotOAuthConfigured(): boolean {
  const cfg = getHubspotMcpOAuthConfig();
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri);
}

export function buildHubspotAuthorizeUrl(input: {
  state: string;
  codeChallenge: string;
}): string {
  const cfg = getHubspotMcpOAuthConfig();
  if (!cfg.clientId || !cfg.redirectUri) {
    throw new Error("HubSpot MCP OAuth is not configured on this deployment.");
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    resource: HUBSPOT_RESOURCE,
  });
  return `${HUBSPOT_AUTHORIZE_URL}?${params.toString()}`;
}

function bundleFromBody(
  body: Record<string, unknown>,
  fallbackRefreshToken?: string | null,
): OAuthTokenBundle {
  const expiresIn = body.expires_in;
  const seconds =
    typeof expiresIn === "number" ? expiresIn : Number(expiresIn) || 1800;
  const refreshToken =
    (typeof body.refresh_token === "string" ? body.refresh_token : null) ??
    fallbackRefreshToken ??
    null;
  const accessToken = body.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("HubSpot token response missing access_token.");
  }
  const hubId = body.hub_id;
  return {
    accessToken,
    refreshToken,
    expiresAtMs: Date.now() + seconds * 1000,
    scopes: [],
    accountLabel:
      typeof hubId === "string" || typeof hubId === "number"
        ? `Hub ${hubId}`
        : null,
    metadata:
      hubId !== undefined && hubId !== null
        ? { portal_id: hubId }
        : null,
  };
}

async function postHubspotToken(
  payload: Record<string, string>,
  requireRefreshToken: boolean,
): Promise<Record<string, unknown>> {
  const cfg = getHubspotMcpOAuthConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error("HubSpot MCP OAuth is not configured.");
  }
  const form = new URLSearchParams({
    ...payload,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    resource: HUBSPOT_RESOURCE,
  });
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const detail =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      response.statusText;
    throw new Error(
      `HubSpot token request failed (${response.status}): ${detail}`,
    );
  }
  if (requireRefreshToken && !data.refresh_token) {
    throw new Error("HubSpot token response missing refresh_token.");
  }
  return data;
}

export async function exchangeHubspotCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<OAuthTokenBundle> {
  const cfg = getHubspotMcpOAuthConfig();
  const body = await postHubspotToken(
    {
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: cfg.redirectUri ?? "",
      code_verifier: input.codeVerifier,
    },
    true,
  );
  return bundleFromBody(body);
}

export async function refreshHubspotToken(
  refreshToken: string,
): Promise<OAuthTokenBundle> {
  const body = await postHubspotToken(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    false,
  );
  return bundleFromBody(body, refreshToken);
}
