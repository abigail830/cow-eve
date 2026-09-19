import type { ArtifactSpec } from "../../../../packages/artifact-spec/src/index.js";
import { buildContentStudioArtifactSpec } from "./artifact-builder.service.js";
import {
  getChatArtifactFormat,
  loadChatArtifactPayload,
  loadSlidePreviewPayload,
} from "../../infrastructure/artifact/local-artifact.store.js";
import { drizzleChatRepository } from "../../infrastructure/persistence/chat/drizzle-chat.repository.js";

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
