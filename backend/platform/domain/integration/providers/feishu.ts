import type { OAuthTokenBundle } from "../oauth/types.js";
import { getFeishuOAuthConfig } from "../../../infrastructure/config/integration-oauth.config.js";

export const INTEGRATION_FEISHU = "feishu";

const DEFAULT_FEISHU_API_BASE = "https://open.feishu.cn";
const DEFAULT_FEISHU_OAUTH_SCOPE =
  "offline_access im:message:readonly docx:document:readonly calendar:calendar:readonly";

export function feishuApiBase(): string {
  const configured = process.env.FEISHU_API_BASE?.trim().replace(/\/$/, "");
  return configured || DEFAULT_FEISHU_API_BASE;
}

function feishuAuthorizeBase(): string {
  const configured = process.env.FEISHU_OAUTH_AUTHORIZE_BASE?.trim().replace(/\/$/, "");
  return configured || "https://accounts.feishu.cn";
}

function feishuOAuthScope(): string {
  const configured = process.env.FEISHU_OAUTH_SCOPE?.trim();
  return configured || DEFAULT_FEISHU_OAUTH_SCOPE;
}

export function isFeishuOAuthConfigured(): boolean {
  const cfg = getFeishuOAuthConfig();
  return Boolean(cfg.appId && cfg.appSecret && cfg.redirectUri);
}

export function buildFeishuAuthorizeUrl(input: {
  state: string;
  codeChallenge: string;
}): string {
  delCodeChallenge(input.codeChallenge);
  const cfg = getFeishuOAuthConfig();
  if (!cfg.appId || !cfg.redirectUri) {
    throw new Error("Feishu OAuth is not configured on this deployment.");
  }
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    state: input.state,
    scope: feishuOAuthScope(),
  });
  return `${feishuAuthorizeBase()}/open-apis/authen/v1/authorize?${params.toString()}`;
}

/** Feishu web OAuth uses client_secret; PKCE is not required. */
function delCodeChallenge(_codeChallenge: string): void {
  /* intentionally unused */
}

function bundleFromBody(
  body: Record<string, unknown>,
  fallbackRefreshToken?: string | null,
): OAuthTokenBundle {
  const expiresIn = body.expires_in;
  const seconds =
    typeof expiresIn === "number" ? expiresIn : Number(expiresIn) || 7200;
  const refreshToken =
    (typeof body.refresh_token === "string" ? body.refresh_token : null) ??
    fallbackRefreshToken ??
    null;
  const scopeRaw = body.scope ?? "";
  const scopes = String(scopeRaw)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const metadata: Record<string, unknown> = {};
  const refreshExpires = body.refresh_token_expires_in;
  if (typeof refreshExpires === "number") {
    metadata.refresh_token_expires_in = refreshExpires;
  }
  const accessToken = body.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Feishu token response missing access_token.");
  }
  return {
    accessToken,
    refreshToken,
    expiresAtMs: Date.now() + seconds * 1000,
    scopes,
    accountLabel: null,
    metadata: Object.keys(metadata).length ? metadata : null,
  };
}

async function postFeishuToken(
  payload: Record<string, string>,
  requireRefreshToken: boolean,
): Promise<Record<string, unknown>> {
  const cfg = getFeishuOAuthConfig();
  if (!cfg.appId || !cfg.appSecret) {
    throw new Error("Feishu OAuth is not configured.");
  }
  const body = {
    ...payload,
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
  };
  const response = await fetch(`${feishuApiBase()}/open-apis/authen/v2/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const code = data.code;
  const okCode = code === 0 || code === undefined || code === null;
  if (!response.ok || !okCode) {
    const detail =
      (typeof data.msg === "string" && data.msg) ||
      (typeof data.error_description === "string" && data.error_description) ||
      (typeof data.error === "string" && data.error) ||
      response.statusText;
    throw new Error(`Feishu token request failed (${response.status}): ${detail}`);
  }
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("Feishu token response missing access_token.");
  }
  if (requireRefreshToken && !data.refresh_token) {
    throw new Error("Feishu token response missing refresh_token.");
  }
  return data;
}

async function fetchFeishuAccountLabel(accessToken: string): Promise<string | null> {
  const url = `${feishuApiBase()}/open-apis/authen/v1/user_info`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (payload.code !== 0) return null;
    const data = payload.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    for (const key of ["email", "name", "en_name"] as const) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function exchangeFeishuCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<OAuthTokenBundle> {
  delCodeChallenge(input.codeVerifier);
  const cfg = getFeishuOAuthConfig();
  const body = await postFeishuToken(
    {
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: cfg.redirectUri ?? "",
    },
    true,
  );
  const bundle = bundleFromBody(body);
  const accountLabel = await fetchFeishuAccountLabel(bundle.accessToken);
  if (accountLabel) {
    return { ...bundle, accountLabel };
  }
  return bundle;
}

export async function refreshFeishuToken(
  refreshToken: string,
): Promise<OAuthTokenBundle> {
  const body = await postFeishuToken(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    false,
  );
  return bundleFromBody(body, refreshToken);
}

export function feishuDocumentIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/docx/")) {
    const segment = trimmed.split("/docx/", 2)[1]?.split("/", 1)[0]?.split("?", 1)[0];
    return segment || null;
  }
  if (trimmed.startsWith("dox")) return trimmed;
  return null;
}
