import { API_URL } from "./config";
import { getToken } from "./session";

export type ProjectPublic = {
  id: string;
  agentId: string;
  name: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
};

async function projectFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function fetchProjectSummary(
  agentId: string,
  limit = 3,
): Promise<ProjectPublic[]> {
  const res = await projectFetch(
    `/api/projects/summary?agentId=${encodeURIComponent(agentId)}&limit=${limit}`,
  );
  const body = (await res.json()) as {
    ok?: boolean;
    projects?: ProjectPublic[];
    error?: string;
  };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? "Failed to load projects");
  }
  return body.projects ?? [];
}

export async function fetchProject(
  projectId: string,
  agentId: string,
): Promise<ProjectPublic> {
  const res = await projectFetch(
    `/api/projects/detail/${encodeURIComponent(projectId)}?agentId=${encodeURIComponent(agentId)}`,
  );
  const body = (await res.json()) as {
    ok?: boolean;
    project?: ProjectPublic;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.project) {
    throw new Error(body.error ?? "Failed to load project");
  }
  return body.project;
}

export async function fetchProjects(agentId: string): Promise<ProjectPublic[]> {
  const res = await projectFetch(
    `/api/projects?agentId=${encodeURIComponent(agentId)}`,
  );
  const body = (await res.json()) as {
    ok?: boolean;
    projects?: ProjectPublic[];
    error?: string;
  };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? "Failed to load projects");
  }
  return body.projects ?? [];
}

export async function createProject(input: {
  agentId: string;
  name: string;
  instructions?: string;
}): Promise<ProjectPublic> {
  const res = await projectFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    project?: ProjectPublic;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.project) {
    throw new Error(body.error ?? "Failed to create project");
  }
  return body.project;
}

export async function updateProject(
  projectId: string,
  agentId: string,
  patch: { name?: string; instructions?: string },
): Promise<ProjectPublic> {
  const res = await projectFetch(
    `/api/projects/detail/${encodeURIComponent(projectId)}?agentId=${encodeURIComponent(agentId)}`,
    {
      method: "PUT",
      body: JSON.stringify(patch),
    },
  );
  const body = (await res.json()) as {
    ok?: boolean;
    project?: ProjectPublic;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.project) {
    throw new Error(body.error ?? "Failed to update project");
  }
  return body.project;
}

export async function deleteProject(
  projectId: string,
  agentId: string,
): Promise<void> {
  const res = await projectFetch(
    `/api/projects/detail/${encodeURIComponent(projectId)}?agentId=${encodeURIComponent(agentId)}`,
    {
      method: "DELETE",
    },
  );
  const body = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? "Failed to delete project");
  }
}

export async function fetchProjectWorkspaceFileIds(
  projectId: string,
): Promise<string[]> {
  const res = await projectFetch(
    `/api/project-workspace-file-refs/${encodeURIComponent(projectId)}`,
  );
  const body = (await res.json()) as {
    ok?: boolean;
    workspaceFileIds?: string[];
    error?: string;
  };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? "Failed to load project context");
  }
  return body.workspaceFileIds ?? [];
}

export async function saveProjectWorkspaceFileIds(
  projectId: string,
  workspaceFileIds: string[],
): Promise<string[]> {
  const res = await projectFetch(
    `/api/project-workspace-file-refs/${encodeURIComponent(projectId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ workspaceFileIds }),
    },
  );
  const body = (await res.json()) as {
    ok?: boolean;
    workspaceFileIds?: string[];
    error?: string;
  };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? "Failed to save project context");
  }
  return body.workspaceFileIds ?? [];
}

export async function bindChatSession(input: {
  eveSessionId: string;
  agentId: string;
  projectId: string | null;
}): Promise<void> {
  const res = await projectFetch("/api/chat-sessions/bind", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? "Failed to bind chat session");
  }
}
