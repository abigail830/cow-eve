import { drizzleWorkspaceRepository } from "../../infrastructure/persistence/workspace/drizzle-workspace.repository.js";

export type WorkspaceFolderPublic = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

function toPublic(row: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceFolderPublic {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listWorkspaceFoldersForUser(
  userId: string,
): Promise<WorkspaceFolderPublic[]> {
  const rows = await drizzleWorkspaceRepository.listFolders(userId);
  return rows.map(toPublic);
}

export async function createWorkspaceFolderForUser(input: {
  userId: string;
  name: string;
}): Promise<WorkspaceFolderPublic | null> {
  const name = input.name.trim();
  if (!name) return null;
  const row = await drizzleWorkspaceRepository.createFolder({
    userId: input.userId,
    name,
  });
  return toPublic(row);
}

export async function renameWorkspaceFolderForUser(input: {
  userId: string;
  folderId: string;
  name: string;
}): Promise<WorkspaceFolderPublic | null> {
  const name = input.name.trim();
  if (!name) return null;
  const row = await drizzleWorkspaceRepository.renameFolder({
    userId: input.userId,
    folderId: input.folderId,
    name,
  });
  return row ? toPublic(row) : null;
}

export async function deleteWorkspaceFolderForUser(input: {
  userId: string;
  folderId: string;
}): Promise<{ deleted: boolean; error?: string }> {
  const deleted = await drizzleWorkspaceRepository.deleteFolder(input);
  if (!deleted) {
    return {
      deleted: false,
      error: "Folder not found or not empty.",
    };
  }
  return { deleted: true };
}
