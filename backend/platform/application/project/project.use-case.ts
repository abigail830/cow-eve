import {
  drizzleProjectRepository,
  type ProjectRecord,
} from "../../infrastructure/persistence/project/drizzle-project.repository.js";

export type ProjectPublic = {
  id: string;
  agentId: string;
  name: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
};

function toPublic(
  row: ProjectRecord & { lastActivityAt: Date },
): ProjectPublic {
  return {
    id: row.id,
    agentId: row.agentId,
    name: row.name,
    instructions: row.instructions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
  };
}

export async function createProjectForUser(input: {
  userId: string;
  agentId: string;
  name: string;
  instructions?: string;
}): Promise<ProjectPublic> {
  const name = input.name.trim();
  if (!name) throw new Error("Project name is required.");
  const row = await drizzleProjectRepository.insert({
    userId: input.userId,
    agentId: input.agentId,
    name,
    instructions: input.instructions,
  });
  return toPublic({ ...row, lastActivityAt: row.updatedAt });
}

export async function listProjectsForUserAgent(input: {
  userId: string;
  agentId: string;
}): Promise<ProjectPublic[]> {
  const rows = await drizzleProjectRepository.listForAgent(input);
  return rows.map(toPublic);
}

export async function listProjectSummaryForUserAgent(input: {
  userId: string;
  agentId: string;
  limit: number;
}): Promise<ProjectPublic[]> {
  const rows = await drizzleProjectRepository.listForAgent(input);
  return rows.slice(0, Math.max(1, input.limit)).map(toPublic);
}

export async function getProjectForUser(input: {
  userId: string;
  projectId: string;
}): Promise<ProjectPublic | null> {
  const row = await drizzleProjectRepository.getForUser(input);
  if (!row) return null;
  return toPublic({ ...row, lastActivityAt: row.updatedAt });
}

export async function updateProjectForUser(input: {
  userId: string;
  projectId: string;
  name?: string;
  instructions?: string;
}): Promise<ProjectPublic | null> {
  const row = await drizzleProjectRepository.updateForUser(input);
  if (!row) return null;
  return toPublic({ ...row, lastActivityAt: row.updatedAt });
}

export async function deleteProjectForUser(input: {
  userId: string;
  projectId: string;
}): Promise<boolean> {
  return drizzleProjectRepository.softDeleteForUser(input);
}

export async function bindChatSessionForUser(input: {
  userId: string;
  agentId: string;
  eveSessionId: string;
  projectId: string | null;
}): Promise<void> {
  const eveSessionId = input.eveSessionId.trim();
  if (!eveSessionId) throw new Error("eveSessionId is required.");

  if (input.projectId) {
    const project = await drizzleProjectRepository.getForUser({
      userId: input.userId,
      projectId: input.projectId,
    });
    if (!project || project.agentId !== input.agentId) {
      throw new Error("Project not found for this agent.");
    }
  }

  await drizzleProjectRepository.upsertSessionBinding({
    eveSessionId,
    userId: input.userId,
    agentId: input.agentId,
    projectId: input.projectId,
  });
}

export async function listProjectWorkspaceFileRefsForUser(input: {
  userId: string;
  projectId: string;
}): Promise<string[]> {
  return drizzleProjectRepository.listWorkspaceFileIds(input);
}

export async function listProjectWorkspaceFileIdsForChat(input: {
  userId: string;
  chatId: string;
}): Promise<string[]> {
  return drizzleProjectRepository.listWorkspaceFileIdsForChat(input);
}

export async function replaceProjectWorkspaceFileRefsForUser(input: {
  userId: string;
  projectId: string;
  workspaceFileIds: readonly string[];
}): Promise<string[]> {
  return drizzleProjectRepository.replaceWorkspaceFileRefs(input);
}

export async function getProjectInstructionsForChat(input: {
  userId: string;
  chatId: string;
}): Promise<string | null> {
  const row = await drizzleProjectRepository.getInstructionsForChat(input);
  return row?.instructions ?? null;
}

export async function touchProjectForChat(input: {
  userId: string;
  chatId: string;
}): Promise<void> {
  const instructions = await drizzleProjectRepository.getInstructionsForChat(
    input,
  );
  if (instructions?.projectId) {
    await drizzleProjectRepository.touchUpdatedAt(instructions.projectId);
  }
}
