import {
  INTEGRATION_HUBSPOT,
  buildHubspotAuthorizeUrl,
  exchangeHubspotCode,
  isHubspotOAuthConfigured,
  refreshHubspotToken,
} from "./providers/hubspot.js";
import {
  INTEGRATION_FEISHU,
  buildFeishuAuthorizeUrl,
  exchangeFeishuCode,
  isFeishuOAuthConfigured,
  refreshFeishuToken,
} from "./providers/feishu.js";
import {
  INTEGRATION_NOTION,
  buildNotionAuthorizeUrl,
  exchangeNotionCode,
  isNotionOAuthConfigured,
  refreshNotionToken,
} from "./providers/notion.js";
import type { OAuthTokenBundle } from "./oauth/types.js";

export type IntegrationAuthKind = "api_key" | "oauth";

export type OAuthIntegrationHandler = {
  id: string;
  authKind: "oauth";
  isPlatformConfigured: () => boolean;
  buildAuthorizeUrl: (input: {
    state: string;
    codeChallenge: string;
  }) => string;
  exchangeCode: (input: {
    code: string;
    codeVerifier: string;
  }) => Promise<OAuthTokenBundle>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuthTokenBundle>;
};

const OAUTH_HANDLERS: Record<string, OAuthIntegrationHandler> = {
  [INTEGRATION_NOTION]: {
    id: INTEGRATION_NOTION,
    authKind: "oauth",
    isPlatformConfigured: isNotionOAuthConfigured,
    buildAuthorizeUrl: buildNotionAuthorizeUrl,
    exchangeCode: exchangeNotionCode,
    refreshAccessToken: refreshNotionToken,
  },
  [INTEGRATION_HUBSPOT]: {
    id: INTEGRATION_HUBSPOT,
    authKind: "oauth",
    isPlatformConfigured: isHubspotOAuthConfigured,
    buildAuthorizeUrl: buildHubspotAuthorizeUrl,
    exchangeCode: exchangeHubspotCode,
    refreshAccessToken: refreshHubspotToken,
  },
  [INTEGRATION_FEISHU]: {
    id: INTEGRATION_FEISHU,
    authKind: "oauth",
    isPlatformConfigured: isFeishuOAuthConfigured,
    buildAuthorizeUrl: buildFeishuAuthorizeUrl,
    exchangeCode: exchangeFeishuCode,
    refreshAccessToken: refreshFeishuToken,
  },
};

export function getOAuthIntegrationHandler(
  integrationId: string,
): OAuthIntegrationHandler | undefined {
  return OAUTH_HANDLERS[integrationId.trim().toLowerCase()];
}

export function isOAuthIntegration(integrationId: string): boolean {
  return Boolean(getOAuthIntegrationHandler(integrationId));
}
