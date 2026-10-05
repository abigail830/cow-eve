import { listChatWorkspaceFileRefsForUser } from "#platform/composition/public-api.js";
import {
  parseSendAttachmentIdsFromMessages,
  parseWorkspaceFileIdsFromMessages,
  readDynamicMessages,
} from "./attachment-rehydrate.js";

function mergeUniqueIds(...groups: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const id of group) {
      const key = id.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

export async function collectSessionDocumentIds(input: {
  ctx: unknown;
  userId: string;
  chatId: string | null;
}): Promise<{
  attachmentIds: string[];
  workspaceFileIds: string[];
}> {
  const messages = readDynamicMessages(input.ctx);
  const attachmentIds = parseSendAttachmentIdsFromMessages(messages);
  const fromMessages = parseWorkspaceFileIdsFromMessages(messages);

  const persisted =
    input.chatId != null
      ? await listChatWorkspaceFileRefsForUser({
          userId: input.userId,
          chatId: input.chatId,
        })
      : [];

  return {
    attachmentIds,
    workspaceFileIds: mergeUniqueIds(fromMessages, persisted),
  };
}
