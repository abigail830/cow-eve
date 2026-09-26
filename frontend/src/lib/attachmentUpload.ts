import { API_URL } from "./config";
import { getToken } from "./session";
import type { PreparedAttachment } from "./attachments";

export type ChatAttachmentPublic = {
  id: string;
  chatId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  contentHash?: string | null;
  parseStatus?: string;
  parsePipelineId?: string | null;
  parseJobId?: string | null;
  parseErrorCode?: string | null;
  parseErrorMessage?: string | null;
  parseStageSnapshot?: Record<string, unknown> | null;
  createdAt: string;
};

export type MentionAttachmentOption = {
  id: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  createdAt: string | null;
};

type UploadTarget = {
  chatId?: string | null;
  eveSessionId?: string | null;
  agentId: string;
};

async function attachmentFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function uploadChatAttachment(
  attachment: PreparedAttachment,
  target: UploadTarget,
): Promise<ChatAttachmentPublic> {
  if (!target.chatId && !target.eveSessionId) {
    throw new Error("Cannot upload attachment before chat session exists.");
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([Uint8Array.from(attachment.bytes)], { type: attachment.mediaType }),
    attachment.filename,
  );
  form.append("agentId", target.agentId);
  if (target.chatId) form.append("chatId", target.chatId);
  if (target.eveSessionId) form.append("eveSessionId", target.eveSessionId);

  const res = await attachmentFetch("/api/chat-attachments", {
    method: "POST",
    body: form,
  });

  let data: { ok?: boolean; error?: string; attachment?: ChatAttachmentPublic };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error(`Invalid upload response (${res.status})`);
  }

  if (!res.ok || !data.attachment) {
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }

  return data.attachment;
}

export async function deleteChatAttachment(
  chatId: string,
  attachmentId: string,
): Promise<void> {
  const res = await attachmentFetch(
    `/api/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  );

  if (!res.ok) {
    let message = `Delete failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}

export async function listChatAttachments(
  chatId: string,
): Promise<ChatAttachmentPublic[]> {
  const res = await attachmentFetch(
    `/api/chats/${encodeURIComponent(chatId)}/attachments`,
  );
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    attachments?: ChatAttachmentPublic[];
  };
  if (!res.ok) {
    throw new Error(data.error ?? `List failed (${res.status})`);
  }
  return data.attachments ?? [];
}

export async function fetchMentionAttachments(input: {
  chatId?: string | null;
  eveSessionId?: string | null;
}): Promise<ChatAttachmentPublic[]> {
  const params = new URLSearchParams();
  if (input.chatId) params.set("chatId", input.chatId);
  else if (input.eveSessionId) params.set("eveSessionId", input.eveSessionId);
  else return [];

  const res = await attachmentFetch(`/api/chat-attachments?${params}`);
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    attachments?: ChatAttachmentPublic[];
  };
  if (!res.ok) {
    throw new Error(data.error ?? `List failed (${res.status})`);
  }
  return data.attachments ?? [];
}

export function mergeMentionAttachmentOptions(
  library: readonly ChatAttachmentPublic[],
  staged: readonly PreparedAttachment[],
): MentionAttachmentOption[] {
  const byFilename = new Map<string, MentionAttachmentOption>();

  for (const item of library) {
    byFilename.set(item.filename.toLowerCase(), {
      id: item.id,
      filename: item.filename,
      mediaType: item.mediaType,
      sizeBytes: item.sizeBytes,
      createdAt: item.createdAt,
    });
  }

  for (const item of staged) {
    const key = item.filename.toLowerCase();
    if (byFilename.has(key)) continue;
    byFilename.set(key, {
      id: item.platformId ?? item.id,
      filename: item.filename,
      mediaType: item.mediaType,
      sizeBytes: item.sizeBytes,
      createdAt: null,
    });
  }

  return [...byFilename.values()].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : Number.MAX_SAFE_INTEGER;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : Number.MAX_SAFE_INTEGER;
    return bTime - aTime;
  });
}

export async function retryChatAttachmentParse(
  chatId: string,
  attachmentId: string,
): Promise<ChatAttachmentPublic> {
  const res = await attachmentFetch(
    `/api/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(attachmentId)}/retry-parse`,
    { method: "POST" },
  );
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    attachment?: ChatAttachmentPublic;
  };
  if (!res.ok || !data.attachment) {
    throw new Error(data.error ?? `Retry failed (${res.status})`);
  }
  return data.attachment;
}

export async function ensureAttachmentsUploaded(
  attachments: readonly PreparedAttachment[],
  target: UploadTarget,
): Promise<PreparedAttachment[]> {
  const next: PreparedAttachment[] = [];
  for (const attachment of attachments) {
    if (attachment.platformId) {
      next.push(attachment);
      continue;
    }
    const saved = await uploadChatAttachment(attachment, target);
    next.push({
      ...attachment,
      platformId: saved.id,
      platformChatId: saved.chatId,
      uploadState: "uploaded",
    });
  }
  return next;
}
