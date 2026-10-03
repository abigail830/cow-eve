import { API_URL } from "./config";
import { getToken } from "./session";

export type KnowledgeBaseItem = {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  itemCount: number | null;
  isConfigured: boolean | null;
  enabled: boolean;
};

export type KnowledgeBaseListResult = {
  connected: boolean;
  items: KnowledgeBaseItem[];
  disabledKbIds: string[];
  message: string | null;
};

async function kbFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

function projectQuery(projectId: string | null | undefined): string {
  if (!projectId?.trim()) return "";
  return `?projectId=${encodeURIComponent(projectId.trim())}`;
}

export async function listAgentKnowledgeBases(
  agentId: string,
  projectId?: string | null,
): Promise<KnowledgeBaseListResult> {
  const res = await kbFetch(
    `/api/agents/${encodeURIComponent(agentId)}/knowledge-bases${projectQuery(projectId)}`,
  );
  const body = (await res.json()) as {
    ok?: boolean;
    connected?: boolean;
    items?: KnowledgeBaseItem[];
    disabledKbIds?: string[];
    message?: string | null;
    error?: string;
  };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? "Failed to load knowledge bases");
  }
  return {
    connected: body.connected ?? false,
    items: body.items ?? [],
    disabledKbIds: body.disabledKbIds ?? [],
    message: body.message ?? null,
  };
}

export async function putAgentKbPreferences(
  agentId: string,
  disabledKbIds: string[],
  projectId?: string | null,
): Promise<{ disabledKbIds: string[] }> {
  const res = await kbFetch(
    `/api/agents/${encodeURIComponent(agentId)}/kb-preferences${projectQuery(projectId)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        disabledKbIds,
        projectId: projectId?.trim() || null,
      }),
    },
  );
  const body = (await res.json()) as {
    ok?: boolean;
    disabledKbIds?: string[];
    error?: string;
  };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? "Failed to save knowledge base preferences");
  }
  return { disabledKbIds: body.disabledKbIds ?? [] };
}
