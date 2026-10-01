import { and, desc, eq, isNull } from "drizzle-orm";
import { chatArtifacts, chats } from "../database/schema.js";
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
  }>
> {
  const db = requireDb();
  const rows = await db
    .select({
      chatId: chatArtifacts.chatId,
      chatTitle: chats.title,
      artifactId: chatArtifacts.artifactId,
      filename: chatArtifacts.filename,
      title: chatArtifacts.title,
      kind: chatArtifacts.kind,
      format: chatArtifacts.format,
      createdAt: chatArtifacts.createdAt,
    })
    .from(chatArtifacts)
    .innerJoin(chats, eq(chats.id, chatArtifacts.chatId))
    .where(
      and(
        eq(chatArtifacts.userId, input.userId),
        eq(chatArtifacts.agentId, input.agentId),
        isNull(chats.deletedAt),
      ),
    )
    .orderBy(desc(chatArtifacts.createdAt));

  return rows;
}

export const drizzleChatArtifactRepository = {
  insert: insertChatArtifact,
  listForAgent: listChatArtifactsForAgent,
};
