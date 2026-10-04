import { API_URL } from "./config";
import { getToken } from "./session";

export type IntegrationAuthKind = "api_key" | "oauth";

export type IntegrationFieldPublic = {
  key: string;
  kind: "secret" | "url" | "text";
  label: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  required: boolean;
  storeInConfig?: boolean;
};

export type IntegrationCredentialScope = "user" | "agent";

export type IntegrationCatalogItem = {
  id: string;
  name: string;
  description: string;
  docUrl: string;
  authKind: IntegrationAuthKind;
  scope: IntegrationCredentialScope;
  platformConfigured: boolean;
  fields: IntegrationFieldPublic[];
  configured: boolean;
  connected: boolean;
  accountLabel: string | null;
  config: Record<string, string>;
  secretHints: Record<string, string | null>;
  updatedAt: string | null;
};

async function integrationFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function fetchIntegrations(
  agentId: string,
): Promise<IntegrationCatalogItem[]> {
  const res = await integrationFetch(
    `/api/integrations?agentId=${encodeURIComponent(agentId)}`,
  );
  const body = (await res.json()) as {
    ok?: boolean;
    integrations?: IntegrationCatalogItem[];
    error?: string;
  };
  if (!res.ok || !body.ok || !body.integrations) {
    throw new Error(body.error ?? `Failed to load integrations (${res.status}).`);
  }
  return body.integrations;
}

export async function saveIntegration(
  integrationId: string,
  agentId: string,
  input: {
    secrets?: Record<string, string | undefined>;
    config?: Record<string, string | undefined>;
  },
): Promise<IntegrationCatalogItem> {
  const res = await integrationFetch(
    `/api/integrations/${encodeURIComponent(integrationId)}?agentId=${encodeURIComponent(agentId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  const body = (await res.json()) as {
    ok?: boolean;
    integration?: IntegrationCatalogItem;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.integration) {
    throw new Error(body.error ?? `Failed to save integration (${res.status}).`);
  }
  return body.integration;
}

export async function connectIntegrationOAuth(
  integrationId: string,
  agentId: string,
): Promise<string> {
  const res = await integrationFetch(
    `/api/integrations/${encodeURIComponent(integrationId)}/connect`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    },
  );
  const body = (await res.json()) as {
    ok?: boolean;
    authorizeUrl?: string;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.authorizeUrl) {
    throw new Error(body.error ?? `Failed to start connect (${res.status}).`);
  }
  return body.authorizeUrl;
}

export async function disconnectIntegrationOAuth(
  integrationId: string,
  agentId: string,
): Promise<void> {
  const res = await integrationFetch(
    `/api/integrations/${encodeURIComponent(integrationId)}/disconnect`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    },
  );
  const body = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? `Failed to disconnect (${res.status}).`);
  }
}
