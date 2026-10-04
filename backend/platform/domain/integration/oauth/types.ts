export type OAuthTokenBundle = {
  accessToken: string;
  refreshToken: string | null;
  expiresAtMs: number;
  scopes: string[];
  accountLabel: string | null;
  metadata: Record<string, unknown> | null;
};

export type StoredIntegrationTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAtMs: number;
  scopes: string[];
  accountLabel: string | null;
  metadata: Record<string, unknown> | null;
};

export const OAUTH_SECRET_FIELD = "oauth";
