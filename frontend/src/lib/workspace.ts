import type { DocumentPreviewBundle } from "@fde/artifact-ui";
import { API_URL } from "./config";
import { getToken } from "./session";

export type { DocumentPreviewBundle };

export type WorkspaceFolderPublic = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceFilePublic = {
  id: string;
  folderId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  parseStatus: string;
  parsePipelineId: string | null;
  parseErrorMessage: string | null;
  gist: string | null;
  createdAt: string;
};

async function workspaceFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function fetchWorkspaceFolders(): Promise<WorkspaceFolderPublic[]> {
  const res = await workspaceFetch("/api/workspace/folders");
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    folders?: WorkspaceFolderPublic[];
  };
  if (!res.ok) throw new Error(data.error ?? `List folders failed (${res.status})`);
  return data.folders ?? [];
}

export async function createWorkspaceFolder(name: string): Promise<WorkspaceFolderPublic> {
  const res = await workspaceFetch("/api/workspace/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    folder?: WorkspaceFolderPublic;
  };
  if (!res.ok || !data.folder) {
    throw new Error(data.error ?? `Create folder failed (${res.status})`);
  }
  return data.folder;
}

export async function renameWorkspaceFolder(
  folderId: string,
  name: string,
): Promise<WorkspaceFolderPublic> {
  const res = await workspaceFetch(
    `/api/workspace/folders/${encodeURIComponent(folderId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    folder?: WorkspaceFolderPublic;
  };
  if (!res.ok || !data.folder) {
    throw new Error(data.error ?? `Rename failed (${res.status})`);
  }
  return data.folder;
}

export async function deleteWorkspaceFolder(folderId: string): Promise<void> {
  const res = await workspaceFetch(
    `/api/workspace/folders/${encodeURIComponent(folderId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `Delete folder failed (${res.status})`);
  }
}

export async function fetchWorkspaceFiles(
  folderId: string,
): Promise<WorkspaceFilePublic[]> {
  const res = await workspaceFetch(
    `/api/workspace/folders/${encodeURIComponent(folderId)}/files`,
  );
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    files?: WorkspaceFilePublic[];
  };
  if (!res.ok) throw new Error(data.error ?? `List files failed (${res.status})`);
  return data.files ?? [];
}

export async function lookupWorkspaceFiles(
  ids: readonly string[],
): Promise<WorkspaceFilePublic[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const res = await workspaceFetch("/api/workspace/batch-file-lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: unique }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    files?: WorkspaceFilePublic[];
  };
  if (!res.ok) throw new Error(data.error ?? `Lookup failed (${res.status})`);
  return data.files ?? [];
}

export async function uploadWorkspaceFile(
  folderId: string,
  file: File,
): Promise<WorkspaceFilePublic> {
  const form = new FormData();
  form.set("file", file);
  let res: Response;
  try {
    res = await workspaceFetch(
      `/api/workspace/folders/${encodeURIComponent(folderId)}/files`,
      { method: "POST", body: form },
    );
  } catch (err: unknown) {
    const hint =
      err instanceof TypeError
        ? `Cannot reach API at ${API_URL}. Is the backend running on that host?`
        : null;
    throw new Error(hint ?? (err instanceof Error ? err.message : "Upload failed"));
  }
  let data: { ok?: boolean; error?: string; file?: WorkspaceFilePublic };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error(`Upload failed (${res.status})`);
  }
  if (!res.ok || !data.file) {
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }
  return data.file;
}

export async function retryWorkspaceFileParse(
  fileId: string,
): Promise<WorkspaceFilePublic> {
  const res = await workspaceFetch(
    `/api/workspace/files/${encodeURIComponent(fileId)}/retry-parse`,
    { method: "POST" },
  );
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    file?: WorkspaceFilePublic;
  };
  if (!res.ok || !data.file) {
    throw new Error(data.error ?? `Retry parse failed (${res.status})`);
  }
  return data.file;
}

export async function deleteWorkspaceFile(fileId: string): Promise<void> {
  let res: Response;
  try {
    res = await workspaceFetch(
      `/api/workspace/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE" },
    );
  } catch (err: unknown) {
    const hint =
      err instanceof TypeError
        ? `Cannot reach API at ${API_URL}. Is the backend running?`
        : null;
    throw new Error(hint ?? (err instanceof Error ? err.message : "Delete failed"));
  }
  let data: { error?: string };
  try {
    data = (await res.json()) as { error?: string };
  } catch {
    throw new Error(`Delete file failed (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(data.error ?? `Delete file failed (${res.status})`);
  }
}

export function workspaceFileFigureUrl(fileId: string, figureId: string): string {
  return `${API_URL}/api/workspace/files/${encodeURIComponent(fileId)}/figures/${encodeURIComponent(figureId)}`;
}

export function workspaceFileDownloadUrl(fileId: string): string {
  return `${API_URL}/api/workspace/files/${encodeURIComponent(fileId)}/download`;
}

export async function fetchWorkspaceFilePreviewBundle(
  fileId: string,
): Promise<DocumentPreviewBundle> {
  const res = await workspaceFetch(
    `/api/workspace/files/${encodeURIComponent(fileId)}/preview-bundle`,
  );
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    bundle?: DocumentPreviewBundle;
  };
  if (!res.ok || !data.bundle) {
    throw new Error(data.error ?? `Preview not available (${res.status})`);
  }
  return data.bundle;
}

export async function fetchWorkspaceFilePreview(
  fileId: string,
): Promise<string> {
  const res = await workspaceFetch(
    `/api/workspace/files/${encodeURIComponent(fileId)}/preview`,
  );
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    markdown?: string;
  };
  if (!res.ok || typeof data.markdown !== "string") {
    throw new Error(data.error ?? `Preview not available (${res.status})`);
  }
  return data.markdown;
}
