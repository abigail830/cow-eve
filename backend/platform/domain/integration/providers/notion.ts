import type { OAuthTokenBundle } from "../oauth/types.js";
import {
  getNotionMcpOAuthConfig,
} from "../../../infrastructure/config/integration-oauth.config.js";
import { getNotionMcpUrl } from "../../../infrastructure/config/mcp.config.js";

export const INTEGRATION_NOTION = "notion";

const NOTION_RESOURCE = "https://mcp.notion.com";
const NOTION_AUTHORIZE_URL = "https://mcp.notion.com/authorize";
const NOTION_TOKEN_URL = "https://mcp.notion.com/token";

export function notionMcpUrl(): string {
  return getNotionMcpUrl();
}

export function isNotionOAuthConfigured(): boolean {
  const cfg = getNotionMcpOAuthConfig();
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri);
}

export function buildNotionAuthorizeUrl(input: {
  state: string;
  codeChallenge: string;
}): string {
  const cfg = getNotionMcpOAuthConfig();
  if (!cfg.clientId || !cfg.redirectUri) {
    throw new Error("Notion MCP OAuth is not configured on this deployment.");
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    resource: NOTION_RESOURCE,
  });
  return `${NOTION_AUTHORIZE_URL}?${params.toString()}`;
}

function bundleFromBody(
  body: Record<string, unknown>,
  fallbackRefreshToken?: string | null,
): OAuthTokenBundle {
  const expiresIn = body.expires_in;
  const seconds =
    typeof expiresIn === "number" ? expiresIn : Number(expiresIn) || 3600;
  const refreshToken =
    (typeof body.refresh_token === "string" ? body.refresh_token : null) ??
    fallbackRefreshToken ??
    null;
  const scopeRaw = body.scope ?? body.scopes ?? "";
  const scopes = String(scopeRaw)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const metadata: Record<string, unknown> = {};
  for (const key of ["workspace_id", "workspace_name", "bot_id", "owner"]) {
    if (key in body) metadata[key] = body[key];
  }
  let accountLabel: string | null = null;
  const workspaceName = metadata.workspace_name;
  if (typeof workspaceName === "string" && workspaceName.trim()) {
    accountLabel = workspaceName.trim();
  }
  const accessToken = body.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Notion token response missing access_token.");
  }
  return {
    accessToken,
    refreshToken,
    expiresAtMs: Date.now() + seconds * 1000,
    scopes,
    accountLabel,
    metadata: Object.keys(metadata).length ? metadata : null,
  };
}

async function postNotionToken(
  payload: Record<string, string>,
  requireRefreshToken: boolean,
): Promise<Record<string, unknown>> {
  const cfg = getNotionMcpOAuthConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error("Notion MCP OAuth is not configured.");
  }
  const form = new URLSearchParams({
    ...payload,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    resource: NOTION_RESOURCE,
  });
  const response = await fetch(NOTION_TOKEN_URL, {
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
      (typeof data.error_description === "string" && data.error_description) ||
      (typeof data.error === "string" && data.error) ||
      response.statusText;
    throw new Error(`Notion token request failed (${response.status}): ${detail}`);
  }
  if (requireRefreshToken && !data.refresh_token) {
    throw new Error("Notion token response missing refresh_token.");
  }
  return data;
}

export async function exchangeNotionCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<OAuthTokenBundle> {
  const cfg = getNotionMcpOAuthConfig();
  const body = await postNotionToken(
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

export async function refreshNotionToken(
  refreshToken: string,
): Promise<OAuthTokenBundle> {
  const body = await postNotionToken(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    false,
  );
  return bundleFromBody(body, refreshToken);
}
