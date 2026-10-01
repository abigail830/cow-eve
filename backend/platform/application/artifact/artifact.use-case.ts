import type { ArtifactSpec } from "../../../../packages/artifact-spec/src/index.js";
import { buildContentStudioArtifactSpec } from "./artifact-builder.service.js";
import { buildChatArtifactSpec } from "./artifact-spec.service.js";
import {
  getChatArtifactFormat,
  loadChatArtifactPayload,
  loadSlidePreviewPayload,
} from "../../infrastructure/artifact/local-artifact.store.js";
import {
  getArtifactMeta,
  listArtifactMetasForChat,
} from "../../infrastructure/artifact/artifact-storage.js";
import { drizzleChatRepository } from "../../infrastructure/persistence/chat/drizzle-chat.repository.js";

export type AgentArtifactListItem = {
  chatId: string;
  chatTitle: string | null;
  artifactId: string;
  filename: string;
  title: string;
  kind: string;
  format: string;
  updatedAt: string | null;
};

export async function publishSandboxArtifact(input: {
  userId: string;
  eveSessionId: string;
  sandboxPath: string;
  fileBytes: Uint8Array;
  title: string;
}): Promise<{ spec: ArtifactSpec | null; error?: string }> {
  const chat = await drizzleChatRepository.getChatByEveSessionForUser({
    userId: input.userId,
    eveSessionId: input.eveSessionId,
  });
  if (!chat) {
    return { spec: null, error: "Chat not found for this session." };
  }

  try {
    const spec = await buildContentStudioArtifactSpec({
      chatId: chat.id,
      sandboxPath: input.sandboxPath,
      fileBytes: input.fileBytes,
      title: input.title,
    });
    return { spec };
  } catch (err) {
    return {
      spec: null,
      error: err instanceof Error ? err.message : "Failed to persist artifact.",
    };
  }
}

export async function getArtifactDownloadForUser(input: {
  userId: string;
  chatId: string;
  artifactId: string;
  variant?: string | null;
}) {
  const chat = await drizzleChatRepository.getChatForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) return null;
  return loadChatArtifactPayload({
    chatId: chat.id,
    artifactId: input.artifactId,
    variant: input.variant,
  });
}

export async function listAgentArtifactsForUser(input: {
  userId: string;
  agentId: string;
}): Promise<AgentArtifactListItem[]> {
  const chats = await drizzleChatRepository.listChats({
    userId: input.userId,
    agentId: input.agentId,
  });
  const items: AgentArtifactListItem[] = [];

  for (const chat of chats) {
    const metas = await listArtifactMetasForChat(chat.id);
    for (const entry of metas) {
      const raw = await getArtifactMeta(chat.id, entry.artifactId);
      const filename =
        typeof raw?.filename === "string" ? raw.filename : entry.artifactId;
      const kind = typeof raw?.kind === "string" ? raw.kind : "content_document";
      const format = typeof raw?.format === "string" ? raw.format : "markdown";
      items.push({
        chatId: chat.id,
        chatTitle: chat.title ?? null,
        artifactId: entry.artifactId,
        filename,
        title: filename,
        kind,
        format,
        updatedAt: entry.updatedAt,
      });
    }
  }

  items.sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return tb - ta;
  });
  return items;
}

export async function getArtifactSpecForUser(input: {
  userId: string;
  chatId: string;
  artifactId: string;
}): Promise<ArtifactSpec | null> {
  const chat = await drizzleChatRepository.getChatForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) return null;
  return buildChatArtifactSpec({
    chatId: chat.id,
    artifactId: input.artifactId,
  });
}

export async function getArtifactPreviewForUser(input: {
  userId: string;
  chatId: string;
  artifactId: string;
  filePath: string;
}) {
  const chat = await drizzleChatRepository.getChatForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) return null;

  const payload = await loadSlidePreviewPayload({
    chatId: chat.id,
    artifactId: input.artifactId,
    filePath: input.filePath,
  });
  if (!payload) return null;

  const deckFormat = await getChatArtifactFormat(chat.id, input.artifactId);
  let data = payload.data;
  if (payload.mediaType.startsWith("text/html")) {
    const html = new TextDecoder().decode(payload.data);
    const baseHref = `/api/chats/${chat.id}/artifacts/${input.artifactId}/preview/`;
    data = Buffer.from(
      html.includes("<head")
        ? html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`)
        : `<!doctype html><html><head><base href="${baseHref}"></head><body>${html}</body></html>`,
      "utf8",
    );
  }

  return {
    data,
    mediaType: payload.mediaType,
    filename: payload.filename,
    deckFormat,
  };
}
