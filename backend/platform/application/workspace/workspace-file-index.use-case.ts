import type { WorkspaceFile } from "../../domain/workspace/workspace-file.entity.js";
import { drizzleWorkspaceRepository } from "../../infrastructure/persistence/workspace/drizzle-workspace.repository.js";

/** Load workspace rows for document indexing (application layer; hides persistence). */
export async function listWorkspaceFilesForDocumentIndex(input: {
  userId: string;
  fileIds: readonly string[];
}): Promise<WorkspaceFile[]> {
  return drizzleWorkspaceRepository.listFilesByIdsForUser(input);
}

export async function getWorkspaceFileForDocumentIndex(input: {
  userId: string;
  fileId: string;
}): Promise<WorkspaceFile | null> {
  return drizzleWorkspaceRepository.getFileForUser(input);
}
