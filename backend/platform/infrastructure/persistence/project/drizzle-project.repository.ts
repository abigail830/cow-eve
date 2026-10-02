import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  chatSessionBindings,
  chats,
  projectWorkspaceFileRefs,
  projects,
  workspaceFiles,
} from "../database/schema.js";
import { requireDb } from "../database/client.js";

export type ProjectRecord = {
  id: string;
  userId: string;
  agentId: string;
  name: string;
  instructions: string;
  createdAt: Date;
  updatedAt: Date;
};

function toProject(row: typeof projects.$inferSelect): ProjectRecord {
  return {
    id: row.id,
    userId: row.userId,
    agentId: row.agentId,
    name: row.name,
    instructions: row.instructions,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function insertProject(input: {
  userId: string;
  agentId: string;
  name: string;
  instructions?: string;
}): Promise<ProjectRecord> {
  const db = requireDb();
  const [row] = await db
    .insert(projects)
    .values({
      userId: input.userId,
      agentId: input.agentId,
      name: input.name.trim(),
      instructions: input.instructions?.trim() ?? "",
    })
    .returning();
  return toProject(row);
}

export async function getProjectForUser(input: {
  userId: string;
  projectId: string;
}): Promise<ProjectRecord | null> {
  const db = requireDb();
  const row = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, input.projectId),
      eq(projects.userId, input.userId),
      isNull(projects.deletedAt),
    ),
  });
  return row ? toProject(row) : null;
}

export async function listProjectsForAgent(input: {
  userId: string;
  agentId: string;
}): Promise<Array<ProjectRecord & { lastActivityAt: Date }>> {
  const db = requireDb();
  const rows = await db.query.projects.findMany({
    where: and(
      eq(projects.userId, input.userId),
      eq(projects.agentId, input.agentId),
      isNull(projects.deletedAt),
    ),
    orderBy: desc(projects.updatedAt),
  });

  return rows.map((row) => ({
    ...toProject(row),
    lastActivityAt: row.updatedAt,
  }));
}

export async function updateProjectForUser(input: {
  userId: string;
  projectId: string;
  name?: string;
  instructions?: string;
}): Promise<ProjectRecord | null> {
  const db = requireDb();
  const patch: Partial<typeof projects.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.instructions !== undefined) {
    patch.instructions = input.instructions.trim();
  }

  const [row] = await db
    .update(projects)
    .set(patch)
    .where(
      and(
        eq(projects.id, input.projectId),
        eq(projects.userId, input.userId),
        isNull(projects.deletedAt),
      ),
    )
    .returning();

  return row ? toProject(row) : null;
}

export async function softDeleteProjectForUser(input: {
  userId: string;
  projectId: string;
}): Promise<boolean> {
  const db = requireDb();
  const [row] = await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(projects.id, input.projectId),
        eq(projects.userId, input.userId),
        isNull(projects.deletedAt),
      ),
    )
    .returning({ id: projects.id });
  return Boolean(row);
}

export async function touchProjectUpdatedAt(projectId: string): Promise<void> {
  const db = requireDb();
  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)));
}

export async function upsertChatSessionBinding(input: {
  eveSessionId: string;
  userId: string;
  agentId: string;
  projectId: string | null;
}): Promise<void> {
  const db = requireDb();
  await db
    .insert(chatSessionBindings)
    .values({
      eveSessionId: input.eveSessionId,
      userId: input.userId,
      agentId: input.agentId,
      projectId: input.projectId,
    })
    .onConflictDoUpdate({
      target: chatSessionBindings.eveSessionId,
      set: {
        projectId: input.projectId,
        agentId: input.agentId,
        userId: input.userId,
      },
    });

  if (!input.projectId) return;
  await db
    .update(chats)
    .set({ projectId: input.projectId, updatedAt: new Date() })
    .where(
      and(
        eq(chats.eveSessionId, input.eveSessionId),
        eq(chats.userId, input.userId),
        isNull(chats.projectId),
        isNull(chats.scheduledTaskId),
      ),
    );
}

export async function getChatSessionBinding(eveSessionId: string): Promise<{
  projectId: string | null;
} | null> {
  const db = requireDb();
  const row = await db.query.chatSessionBindings.findFirst({
    where: eq(chatSessionBindings.eveSessionId, eveSessionId),
  });
  if (!row) return null;
  return { projectId: row.projectId ?? null };
}

export async function listProjectWorkspaceFileIds(input: {
  userId: string;
  projectId: string;
}): Promise<string[]> {
  const db = requireDb();
  const project = await getProjectForUser({
    userId: input.userId,
    projectId: input.projectId,
  });
  if (!project) return [];

  const rows = await db
    .select({ workspaceFileId: projectWorkspaceFileRefs.workspaceFileId })
    .from(projectWorkspaceFileRefs)
    .innerJoin(
      workspaceFiles,
      eq(workspaceFiles.id, projectWorkspaceFileRefs.workspaceFileId),
    )
    .where(
      and(
        eq(projectWorkspaceFileRefs.projectId, input.projectId),
        eq(workspaceFiles.userId, input.userId),
      ),
    )
    .orderBy(desc(projectWorkspaceFileRefs.createdAt));

  return rows.map((r) => r.workspaceFileId);
}

export async function replaceProjectWorkspaceFileRefs(input: {
  userId: string;
  projectId: string;
  workspaceFileIds: readonly string[];
}): Promise<string[]> {
  const db = requireDb();
  const project = await getProjectForUser({
    userId: input.userId,
    projectId: input.projectId,
  });
  if (!project) {
    throw new Error("Project not found.");
  }

  const ids = [
    ...new Set(input.workspaceFileIds.map((id) => id.trim()).filter(Boolean)),
  ];

  if (ids.length > 0) {
    const owned = await db
      .select({ id: workspaceFiles.id })
      .from(workspaceFiles)
      .where(
        and(
          eq(workspaceFiles.userId, input.userId),
          inArray(workspaceFiles.id, ids),
        ),
      );
    const ownedSet = new Set(owned.map((r) => r.id));
    for (const id of ids) {
      if (!ownedSet.has(id)) {
        throw new Error(`Workspace file not found: ${id}`);
      }
    }
  }

  await db
    .delete(projectWorkspaceFileRefs)
    .where(eq(projectWorkspaceFileRefs.projectId, input.projectId));

  if (ids.length > 0) {
    await db.insert(projectWorkspaceFileRefs).values(
      ids.map((workspaceFileId) => ({
        projectId: input.projectId,
        workspaceFileId,
      })),
    );
  }

  await touchProjectUpdatedAt(input.projectId);
  return ids;
}

export async function listProjectWorkspaceFileIdsForChat(input: {
  userId: string;
  chatId: string;
}): Promise<string[]> {
  const db = requireDb();
  const chat = await db.query.chats.findFirst({
    where: and(
      eq(chats.id, input.chatId),
      eq(chats.userId, input.userId),
      isNull(chats.deletedAt),
    ),
    columns: { projectId: true },
  });
  if (!chat?.projectId) return [];
  return listProjectWorkspaceFileIds({
    userId: input.userId,
    projectId: chat.projectId,
  });
}

export async function getProjectInstructionsForChat(input: {
  userId: string;
  chatId: string;
}): Promise<{ projectId: string; instructions: string } | null> {
  const db = requireDb();
  const chat = await db.query.chats.findFirst({
    where: and(
      eq(chats.id, input.chatId),
      eq(chats.userId, input.userId),
      isNull(chats.deletedAt),
    ),
    columns: { projectId: true },
  });
  if (!chat?.projectId) return null;

  const project = await getProjectForUser({
    userId: input.userId,
    projectId: chat.projectId,
  });
  if (!project || !project.instructions.trim()) return null;

  return {
    projectId: project.id,
    instructions: project.instructions.trim(),
  };
}

export const drizzleProjectRepository = {
  insert: insertProject,
  getForUser: getProjectForUser,
  listForAgent: listProjectsForAgent,
  updateForUser: updateProjectForUser,
  softDeleteForUser: softDeleteProjectForUser,
  touchUpdatedAt: touchProjectUpdatedAt,
  upsertSessionBinding: upsertChatSessionBinding,
  getSessionBinding: getChatSessionBinding,
  listWorkspaceFileIds: listProjectWorkspaceFileIds,
  replaceWorkspaceFileRefs: replaceProjectWorkspaceFileRefs,
  getInstructionsForChat: getProjectInstructionsForChat,
  listWorkspaceFileIdsForChat: listProjectWorkspaceFileIdsForChat,
};
