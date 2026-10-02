import { and, desc, eq, isNull } from "drizzle-orm";
import {
  chatArtifacts,
  chats,
  projects,
  scheduledTasks,
} from "../database/schema.js";
import { requireDb } from "../database/client.js";

export type ChatArtifactRecord = {
  chatId: string;
  artifactId: string;
  userId: string;
  agentId: string;
  filename: string;
  title: string;
  kind: string;
  format: string;
};

export type ArtifactSourceKind = "generic" | "project" | "schedule";

export async function insertChatArtifact(record: ChatArtifactRecord): Promise<void> {
  const db = requireDb();
  await db.insert(chatArtifacts).values({
    chatId: record.chatId,
    artifactId: record.artifactId,
    userId: record.userId,
    agentId: record.agentId,
    filename: record.filename,
    title: record.title,
    kind: record.kind,
    format: record.format,
  });
}

export async function listChatArtifactsForAgent(input: {
  userId: string;
  agentId: string;
  source?: ArtifactSourceKind;
  projectId?: string;
  scheduleId?: string;
}): Promise<
  Array<{
    chatId: string;
    chatTitle: string | null;
    artifactId: string;
    filename: string;
    title: string;
    kind: string;
    format: string;
    createdAt: Date;
    source: ArtifactSourceKind;
    projectId: string | null;
    projectName: string | null;
    scheduleId: string | null;
    scheduleName: string | null;
  }>
> {
  const db = requireDb();
  const conditions = [
    eq(chatArtifacts.userId, input.userId),
    eq(chatArtifacts.agentId, input.agentId),
    isNull(chats.deletedAt),
  ];

  if (input.source === "generic") {
    conditions.push(isNull(chats.projectId));
    conditions.push(isNull(chats.scheduledTaskId));
  } else if (input.source === "project") {
    const projectId = input.projectId?.trim();
    if (!projectId) return [];
    conditions.push(eq(chats.projectId, projectId));
  } else if (input.source === "schedule") {
    const scheduleId = input.scheduleId?.trim();
    if (!scheduleId) return [];
    conditions.push(eq(chats.scheduledTaskId, scheduleId));
  }

  const rows = await db
    .select({
      chatId: chatArtifacts.chatId,
      chatTitle: chats.title,
      chatProjectId: chats.projectId,
      chatScheduledTaskId: chats.scheduledTaskId,
      artifactId: chatArtifacts.artifactId,
      filename: chatArtifacts.filename,
      title: chatArtifacts.title,
      kind: chatArtifacts.kind,
      format: chatArtifacts.format,
      createdAt: chatArtifacts.createdAt,
      projectName: projects.name,
      scheduleName: scheduledTasks.name,
      schedulePrompt: scheduledTasks.prompt,
    })
    .from(chatArtifacts)
    .innerJoin(chats, eq(chats.id, chatArtifacts.chatId))
    .leftJoin(projects, eq(projects.id, chats.projectId))
    .leftJoin(scheduledTasks, eq(scheduledTasks.id, chats.scheduledTaskId))
    .where(and(...conditions))
    .orderBy(desc(chatArtifacts.createdAt));

  return rows.map((row) => {
    let source: ArtifactSourceKind = "generic";
    if (row.chatScheduledTaskId) source = "schedule";
    else if (row.chatProjectId) source = "project";

    const scheduleLabel =
      row.scheduleName?.trim() ||
      (row.schedulePrompt
        ? row.schedulePrompt.slice(0, 48) +
          (row.schedulePrompt.length > 48 ? "…" : "")
        : null);

    return {
      chatId: row.chatId,
      chatTitle: row.chatTitle ?? null,
      artifactId: row.artifactId,
      filename: row.filename,
      title: row.title,
      kind: row.kind,
      format: row.format,
      createdAt: row.createdAt,
      source,
      projectId: row.chatProjectId ?? null,
      projectName: row.projectName ?? null,
      scheduleId: row.chatScheduledTaskId ?? null,
      scheduleName: scheduleLabel,
    };
  });
}

export const drizzleChatArtifactRepository = {
  insert: insertChatArtifact,
  listForAgent: listChatArtifactsForAgent,
};
