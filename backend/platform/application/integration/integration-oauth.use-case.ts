import {
  createOAuthState,
  consumeOAuthState,
  generateCodeChallenge,
  generateCodeVerifier,
} from "../../domain/integration/oauth/pkce.js";
import { getOAuthIntegrationHandler } from "../../domain/integration/integration-oauth-registry.js";
import {
  getIntegrationOAuthStateSecret,
  getIntegrationSuccessRedirectBase,
} from "../../infrastructure/config/integration-oauth.config.js";
import {
  integrationCredentialScopeForId,
  requireAgentIdForIntegration,
} from "../../domain/integration/integration-scope.js";
import {
  disconnectOAuthIntegration,
  saveOAuthTokens,
} from "./integration-token.service.js";

export async function beginIntegrationOAuth(input: {
  userId: string;
  integrationId: string;
  agentId?: string;
}): Promise<{ authorizeUrl: string }> {
  const handler = getOAuthIntegrationHandler(input.integrationId);
  if (!handler) throw new Error("Unknown integration.");
  if (!handler.isPlatformConfigured()) {
    throw new Error(
      "This integration is not configured on this deployment. Contact your administrator.",
    );
  }
  const agentKey = requireAgentIdForIntegration(
    input.integrationId,
    input.agentId,
  );
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = createOAuthState({
    userId: input.userId,
    provider: handler.id,
    codeVerifier,
    signingKey: getIntegrationOAuthStateSecret(),
    agentId: agentKey || input.agentId,
  });
  const authorizeUrl = handler.buildAuthorizeUrl({ state, codeChallenge });
  return { authorizeUrl };
}

export async function completeIntegrationOAuth(input: {
  integrationId: string;
  code: string;
  state: string;
}): Promise<{ userId: string; agentId?: string }> {
  const handler = getOAuthIntegrationHandler(input.integrationId);
  if (!handler) throw new Error("Unknown integration.");

  const pending = consumeOAuthState(
    input.state,
    getIntegrationOAuthStateSecret(),
  );
  if (!pending || pending.provider !== handler.id) {
    throw new Error("Invalid or expired OAuth state.");
  }

  const bundle = await handler.exchangeCode({
    code: input.code,
    codeVerifier: pending.codeVerifier,
  });
  const agentId =
    integrationCredentialScopeForId(handler.id) === "agent"
      ? requireAgentIdForIntegration(handler.id, pending.agentId)
      : pending.agentId?.trim() ?? "";
  await saveOAuthTokens({
    userId: pending.userId,
    agentId,
    integrationId: handler.id,
    bundle,
  });
  return { userId: pending.userId, agentId: pending.agentId };
}

export async function disconnectIntegrationOAuth(input: {
  userId: string;
  integrationId: string;
  agentId?: string;
}): Promise<boolean> {
  const handler = getOAuthIntegrationHandler(input.integrationId);
  if (!handler) throw new Error("Unknown integration.");
  const agentKey = requireAgentIdForIntegration(
    input.integrationId,
    input.agentId,
  );
  return disconnectOAuthIntegration({
    userId: input.userId,
    agentId: agentKey,
    integrationId: input.integrationId,
  });
}

export function integrationOAuthCallbackRedirect(input: {
  integrationId: string;
  status: "connected" | "error";
  error?: string;
  agentId?: string;
}): string {
  const base = getIntegrationSuccessRedirectBase();
  const url = new URL(base.includes("://") ? base : `https://${base}`);
  url.searchParams.set("integrations", "1");
  url.searchParams.set("provider", input.integrationId);
  url.searchParams.set("status", input.status);
  if (input.agentId?.trim()) {
    url.searchParams.set("agentId", input.agentId.trim());
  }
  if (input.error?.trim()) {
    url.searchParams.set("error", input.error.trim());
  }
  return url.toString();
}
