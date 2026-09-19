import { API_URL } from "./config";
import { getToken } from "./session";

export type AgentCategory = "omni" | "domain";

export type AgentInfo = {
  id: string;
  category: AgentCategory;
  displayName: string;
  description: string;
  avatar: string;
  eveAgent: string;
  defaultDevUrl: string;
};

export type ModelReasoning =
  | "provider-default"
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type ModelPreset = {
  id: string;
  label: string;
  displayName: string;
  baseURL: string;
  modelId: string;
  contextWindowTokens: number;
};

export type ModelSettingsPublic = {
  presetId: string;
  displayName: string;
  baseURL: string;
  modelId: string;
  contextWindowTokens: number;
  reasoning: ModelReasoning;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  updatedAt: string | null;
};

export type ModelEntryPublic = {
  id: string;
  presetId: string;
  displayName: string;
  baseURL: string;
  modelId: string;
  contextWindowTokens: number;
  reasoning: ModelReasoning;
  hasApiKey: boolean;
  apiKeyHint: string | null;
};

export type ModelCatalogPublic = {
  models: ModelEntryPublic[];
  defaultId: string;
  updatedAt: string | null;
};

export type ModelEntryUpdate = {
  id: string;
  presetId: string;
  displayName: string;
  baseURL: string;
  modelId: string;
  contextWindowTokens: number;
  reasoning: ModelReasoning;
  apiKey?: string;
};

export type ModelCatalogUpdate = {
  defaultId: string;
  models: ModelEntryUpdate[];
};

export type ChatSummary = {
  id: string;
  agentId: string;
  eveSessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatDetail = ChatSummary & {
  /** Eve session stream cursor; must equal events.length for resume catch-up. */
  streamIndex: number;
  events: unknown[];
};

export type PreferenceEntry = {
  index: number;
  text: string;
};

export type MemoryEntry = {
  id: string;
  text: string;
  source: string | null;
  sessionId: string | null;
};

export type UserMemorySnapshot = {
  globalPreferences: PreferenceEntry[];
  agentMemories: MemoryEntry[];
};

async function api<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (init?.auth !== false) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error(
      `Cannot reach API at ${API_URL}. Is the backend running?`,
    );
  }

  let data: T & { ok?: boolean; error?: string };
  try {
    data = (await res.json()) as T & { ok?: boolean; error?: string };
  } catch {
    throw new Error(`Invalid response from API (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Request failed (${res.status})`,
    );
  }
  return data;
}

export async function login(email: string, password: string) {
  return api<{
    ok: true;
    token: string;
    user: { email: string; displayName: string };
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    auth: false,
  });
}

export async function fetchAgents() {
  return api<{ ok: true; agents: AgentInfo[] }>("/api/agents");
}

export async function fetchModelSettings() {
  return api<{
    ok: true;
    settings: ModelSettingsPublic;
    catalog: ModelCatalogPublic;
  }>("/api/settings/model");
}

export async function fetchModelPresets() {
  return api<{ ok: true; presets: ModelPreset[] }>(
    "/api/settings/model/presets",
  );
}

export async function saveModelCatalog(update: ModelCatalogUpdate) {
  return api<{
    ok: true;
    settings: ModelSettingsPublic;
    catalog: ModelCatalogPublic;
  }>("/api/settings/model", {
    method: "PUT",
    body: JSON.stringify(update),
  });
}

export async function fetchChats(agentId: string) {
  return api<{ ok: true; chats: ChatSummary[] }>(
    `/api/chats?agentId=${encodeURIComponent(agentId)}`,
  );
}

export async function fetchChat(chatId: string) {
  return api<{ ok: true; chat: ChatDetail }>(
    `/api/chats/${encodeURIComponent(chatId)}`,
  );
}

export async function deleteChat(chatId: string) {
  return api<{ ok: true }>(`/api/chats/${encodeURIComponent(chatId)}`, {
    method: "DELETE",
  });
}

export async function fetchMemory(agentId: string) {
  return api<{ ok: true; memory: UserMemorySnapshot }>(
    `/api/memory?agentId=${encodeURIComponent(agentId)}`,
  );
}

export type PlatformUserPublic = {
  email: string;
  displayName: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export async function fetchUsers() {
  return api<{ ok: true; users: PlatformUserPublic[] }>("/api/settings/users");
}

export async function createUser(email: string, password: string) {
  return api<{ ok: true; user: PlatformUserPublic }>("/api/settings/users", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function deleteUser(email: string) {
  return api<{ ok: true }>(
    `/api/settings/users/${encodeURIComponent(email)}`,
    { method: "DELETE" },
  );
}
