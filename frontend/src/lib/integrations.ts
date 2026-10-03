import { API_URL } from "./config";
import { getToken } from "./session";

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

export type IntegrationCatalogItem = {
  id: string;
  name: string;
  description: string;
  docUrl: string;
  fields: IntegrationFieldPublic[];
  configured: boolean;
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
  input: {
    secrets?: Record<string, string | undefined>;
    config?: Record<string, string | undefined>;
  },
): Promise<IntegrationCatalogItem> {
  const res = await integrationFetch(
    `/api/integrations/${encodeURIComponent(integrationId)}`,
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
