import {
  decryptSecret,
  encryptSecret,
} from "../../infrastructure/crypto/aes-secret-cipher.js";
import { getOAuthIntegrationHandler } from "../../domain/integration/integration-oauth-registry.js";
import { requireAgentIdForIntegration } from "../../domain/integration/integration-scope.js";
import {
  OAUTH_SECRET_FIELD,
  type OAuthTokenBundle,
  type StoredIntegrationTokens,
} from "../../domain/integration/oauth/types.js";
import {
  getIntegrationCredentialRow,
  upsertIntegrationCredentialRow,
} from "./integration-credential.store.js";

const REFRESH_SKEW_MS = 60_000;
const refreshFlights = new Map<string, Promise<StoredIntegrationTokens | null>>();

function bundleToJson(bundle: OAuthTokenBundle): string {
  return JSON.stringify({
    access_token: bundle.accessToken,
    refresh_token: bundle.refreshToken,
    expires_at_ms: bundle.expiresAtMs,
    scopes: bundle.scopes,
    account_label: bundle.accountLabel,
    metadata: bundle.metadata ?? {},
  });
}

function jsonToStored(payload: Record<string, unknown>): StoredIntegrationTokens | null {
  const accessToken = payload.access_token;
  const expiresAtMs = payload.expires_at_ms;
  if (typeof accessToken !== "string" || !accessToken) return null;
  if (typeof expiresAtMs !== "number") return null;
  const refreshToken = payload.refresh_token;
  const scopes = payload.scopes;
  const accountLabel = payload.account_label;
  const metadata = payload.metadata;
  return {
    accessToken,
    refreshToken:
      typeof refreshToken === "string" && refreshToken ? refreshToken : null,
    expiresAtMs,
    scopes: Array.isArray(scopes)
      ? scopes.filter((s): s is string => typeof s === "string")
      : [],
    accountLabel:
      typeof accountLabel === "string" && accountLabel.trim()
        ? accountLabel.trim()
        : null,
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : null,
  };
}

function readStoredFromSecrets(
  secretsEncrypted: Record<string, string>,
): StoredIntegrationTokens | null {
  const enc = secretsEncrypted[OAUTH_SECRET_FIELD];
  if (!enc?.trim()) return null;
  try {
    const plain = decryptSecret(enc);
    const parsed = JSON.parse(plain) as Record<string, unknown>;
    return jsonToStored(parsed);
  } catch {
    return null;
  }
}

function resolveAgentKey(integrationId: string, agentId: string): string {
  requireAgentIdForIntegration(integrationId, agentId);
  return agentId.trim();
}

export async function saveOAuthTokens(input: {
  userId: string;
  agentId: string;
  integrationId: string;
  bundle: OAuthTokenBundle;
}): Promise<void> {
  const agentKey = resolveAgentKey(input.integrationId, input.agentId);
  const existing = await getIntegrationCredentialRow({
    userId: input.userId,
    agentId: agentKey,
    integrationId: input.integrationId,
  });
  const secretsEncrypted: Record<string, string> = {
    ...(existing?.secretsEncrypted ?? {}),
  };
  secretsEncrypted[OAUTH_SECRET_FIELD] = encryptSecret(
    bundleToJson(input.bundle),
  );
  const config: Record<string, unknown> = { ...(existing?.config ?? {}) };
  if (input.bundle.accountLabel) {
    config.accountLabel = input.bundle.accountLabel;
  }
  await upsertIntegrationCredentialRow({
    userId: input.userId,
    agentId: agentKey,
    integrationId: input.integrationId,
    secretsEncrypted,
    config,
  });
}

export async function loadOAuthTokens(
  userId: string,
  agentId: string,
  integrationId: string,
): Promise<StoredIntegrationTokens | null> {
  const agentKey = resolveAgentKey(integrationId, agentId);
  const row = await getIntegrationCredentialRow({
    userId,
    agentId: agentKey,
    integrationId,
  });
  if (!row) return null;
  return readStoredFromSecrets(row.secretsEncrypted);
}

export async function disconnectOAuthIntegration(input: {
  userId: string;
  agentId: string;
  integrationId: string;
}): Promise<boolean> {
  const agentKey = resolveAgentKey(input.integrationId, input.agentId);
  const row = await getIntegrationCredentialRow({
    userId: input.userId,
    agentId: agentKey,
    integrationId: input.integrationId,
  });
  if (!row) return false;
  const secretsEncrypted = { ...row.secretsEncrypted };
  delete secretsEncrypted[OAUTH_SECRET_FIELD];
  const config = { ...row.config };
  delete config.accountLabel;
  await upsertIntegrationCredentialRow({
    userId: input.userId,
    agentId: agentKey,
    integrationId: input.integrationId,
    secretsEncrypted,
    config,
  });
  return true;
}

async function refreshOnce(
  userId: string,
  agentId: string,
  integrationId: string,
): Promise<StoredIntegrationTokens | null> {
  const stored = await loadOAuthTokens(userId, agentId, integrationId);
  if (!stored?.refreshToken) return null;
  const handler = getOAuthIntegrationHandler(integrationId);
  if (!handler) return null;
  try {
    const bundle = await handler.refreshAccessToken(stored.refreshToken);
    const merged: OAuthTokenBundle = {
      accessToken: bundle.accessToken,
      refreshToken: bundle.refreshToken ?? stored.refreshToken,
      expiresAtMs: bundle.expiresAtMs,
      scopes: bundle.scopes.length ? bundle.scopes : stored.scopes,
      accountLabel: bundle.accountLabel ?? stored.accountLabel,
      metadata: { ...(stored.metadata ?? {}), ...(bundle.metadata ?? {}) },
    };
    await saveOAuthTokens({
      userId,
      agentId,
      integrationId,
      bundle: merged,
    });
    return loadOAuthTokens(userId, agentId, integrationId);
  } catch {
    return null;
  }
}

export async function getValidOAuthAccessToken(
  userId: string,
  agentId: string,
  integrationId: string,
): Promise<string | null> {
  const stored = await loadOAuthTokens(userId, agentId, integrationId);
  if (!stored) return null;
  if (stored.expiresAtMs - REFRESH_SKEW_MS > Date.now()) {
    return stored.accessToken;
  }
  const flightKey = `${userId}:${agentId}:${integrationId}`;
  let flight = refreshFlights.get(flightKey);
  if (!flight) {
    flight = refreshOnce(userId, agentId, integrationId);
    refreshFlights.set(flightKey, flight);
    flight.finally(() => {
      if (refreshFlights.get(flightKey) === flight) {
        refreshFlights.delete(flightKey);
      }
    });
  }
  const refreshed = await flight;
  return refreshed?.accessToken ?? null;
}

export function readAccountLabelFromConfig(
  config: Record<string, unknown>,
): string | null {
  const label = config.accountLabel;
  return typeof label === "string" && label.trim() ? label.trim() : null;
}
