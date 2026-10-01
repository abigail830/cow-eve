import type { ArtifactSpec } from "@fde/artifact-spec";
import { API_URL } from "./config";
import { getToken } from "./session";

export type AgentArtifactListItem = {
  chatId: string;
  chatTitle: string | null;
  artifactId: string;
  filename: string;
  title: string;
  kind: string;
  format: string;
  updatedAt: string | null;
};

async function artifactFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function fetchAgentArtifacts(
  agentId: string,
): Promise<AgentArtifactListItem[]> {
  const res = await artifactFetch(
    `/api/agents/${encodeURIComponent(agentId)}/artifacts`,
  );
  const body = (await res.json()) as {
    ok?: boolean;
    artifacts?: AgentArtifactListItem[];
    error?: string;
  };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? "Failed to load artifacts");
  }
  return body.artifacts ?? [];
}

export async function fetchArtifactSpec(
  chatId: string,
  artifactId: string,
): Promise<ArtifactSpec> {
  const res = await artifactFetch(
    `/api/chats/${encodeURIComponent(chatId)}/artifacts/${encodeURIComponent(artifactId)}/spec`,
  );
  const body = (await res.json()) as {
    ok?: boolean;
    spec?: ArtifactSpec;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.spec) {
    throw new Error(body.error ?? "Failed to load artifact preview");
  }
  return body.spec;
}

export function formatArtifactTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}
