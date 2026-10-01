import { drizzleChatRepository } from "../../infrastructure/persistence/chat/drizzle-chat.repository.js";
import { listWorkspaceFilesForDocumentIndex } from "../workspace/workspace-file-index.use-case.js";

export async function registerChatWorkspaceFileRefsForUser(input: {
  userId: string;
  chatId: string;
  workspaceFileIds: readonly string[];
}): Promise<void> {
  const ids = [
    ...new Set(
      input.workspaceFileIds.map((id) => id.trim()).filter(Boolean),
    ),
  ];
  if (ids.length === 0) return;

  const chat = await drizzleChatRepository.getChatMetaById(input.chatId);
  if (!chat || chat.userId !== input.userId) {
    throw new Error("Chat not found.");
  }

  const owned = await listWorkspaceFilesForDocumentIndex({
    userId: input.userId,
    fileIds: ids,
  });
  const ownedIds = owned.map((row) => row.id);
  if (ownedIds.length === 0) return;

  await drizzleChatRepository.addChatWorkspaceFileRefs({
    chatId: chat.id,
    workspaceFileIds: ownedIds,
  });
}

export async function listChatWorkspaceFileRefsForUser(input: {
  userId: string;
  chatId: string;
}): Promise<string[]> {
  const chat = await drizzleChatRepository.getChatMetaById(input.chatId);
  if (!chat || chat.userId !== input.userId) return [];

  return drizzleChatRepository.listChatWorkspaceFileRefs({
    chatId: chat.id,
    userId: input.userId,
  });
}
