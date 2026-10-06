import { upload } from "@vercel/blob/client";
import { API_URL } from "./config";
import { ATTACHMENT_LIMITS } from "./attachments";
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
  source?: "chat" | "workspace";
  parseStatus?: string | null;
  parsePipelineId?: string | null;
  parseJobId?: string | null;
};

type UploadTarget = {
  chatId?: string | null;
  eveSessionId?: string | null;
  agentId: string;
  /** When false, store without enqueueing parse (audio capture parts). */
  skipParse?: boolean;
};

type UploadPolicy = {
  maxBytesPerFile: number;
  serverMultipartMaxBytes: number;
  clientBlobUpload: boolean;
};

let uploadPolicyCache: UploadPolicy | null = null;

async function attachmentFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getUploadPolicy(): Promise<UploadPolicy> {
  if (uploadPolicyCache) return uploadPolicyCache;
  const res = await attachmentFetch("/api/chat-attachments/upload-policy");
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    policy?: UploadPolicy;
  };
  if (!res.ok || !data.policy) {
    uploadPolicyCache = {
      maxBytesPerFile: ATTACHMENT_LIMITS.maxBytesPerFile,
      serverMultipartMaxBytes: ATTACHMENT_LIMITS.serverMultipartMaxBytes,
      clientBlobUpload: false,
    };
    return uploadPolicyCache;
  }
  uploadPolicyCache = data.policy;
  return uploadPolicyCache;
}

function shouldUseDirectBlobUpload(
  sizeBytes: number,
  policy: UploadPolicy,
): boolean {
  return (
    policy.clientBlobUpload &&
    sizeBytes > policy.serverMultipartMaxBytes
  );
}

async function uploadChatAttachmentViaBlob(
  attachment: PreparedAttachment,
  target: UploadTarget,
): Promise<ChatAttachmentPublic> {
  const prepareRes = await attachmentFetch(
    "/api/chat-attachments/prepare-blob-upload",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: target.chatId ?? undefined,
        eveSessionId: target.eveSessionId ?? undefined,
        agentId: target.agentId,
        filename: attachment.filename,
        mediaType: attachment.mediaType,
        sizeBytes: attachment.sizeBytes,
      }),
    },
  );
  const prepared = (await prepareRes.json()) as {
    ok?: boolean;
    error?: string;
    attachmentId?: string;
    chatId?: string;
    pathname?: string;
    clientPayload?: string;
  };
  if (
    !prepareRes.ok ||
    !prepared.attachmentId ||
    !prepared.chatId ||
    !prepared.pathname ||
    !prepared.clientPayload
  ) {
    throw new Error(prepared.error ?? `Prepare upload failed (${prepareRes.status})`);
  }

  const body = new Blob([Uint8Array.from(attachment.bytes)], {
    type: attachment.mediaType,
  });

  await upload(prepared.pathname, body, {
    access: "private",
    handleUploadUrl: `${API_URL}/api/chat-attachments/blob-upload`,
    clientPayload: prepared.clientPayload,
    headers: authHeaders(),
    multipart: attachment.sizeBytes > 8 * 1024 * 1024,
    contentType: attachment.mediaType,
  });

  const finalizeRes = await attachmentFetch(
    "/api/chat-attachments/finalize-blob-upload",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachmentId: prepared.attachmentId,
        chatId: prepared.chatId,
        agentId: target.agentId,
        filename: attachment.filename,
        mediaType: attachment.mediaType,
        sizeBytes: attachment.sizeBytes,
        enqueueParse: target.skipParse ? false : undefined,
      }),
    },
  );

  const finalized = (await finalizeRes.json()) as {
    ok?: boolean;
    error?: string;
    warning?: string;
    attachment?: ChatAttachmentPublic;
  };
  if (!finalizeRes.ok || !finalized.attachment) {
    throw new Error(finalized.error ?? `Finalize upload failed (${finalizeRes.status})`);
  }
  if (finalized.warning?.trim()) {
    throw new Error(finalized.warning);
  }
  return finalized.attachment;
}

async function uploadChatAttachmentViaMultipart(
  attachment: PreparedAttachment,
  target: UploadTarget,
): Promise<ChatAttachmentPublic> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([Uint8Array.from(attachment.bytes)], { type: attachment.mediaType }),
    attachment.filename,
  );
  form.append("agentId", target.agentId);
  if (target.chatId) form.append("chatId", target.chatId);
  if (target.eveSessionId) form.append("eveSessionId", target.eveSessionId);
  if (target.skipParse) form.append("enqueueParse", "false");

  const res = await attachmentFetch("/api/chat-attachments", {
    method: "POST",
    body: form,
  });

  let data: {
    ok?: boolean;
    error?: string;
    warning?: string;
    attachment?: ChatAttachmentPublic;
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error(`Invalid upload response (${res.status})`);
  }

  if (!res.ok || !data.attachment) {
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }

  if (data.warning?.trim()) {
    throw new Error(data.warning);
  }

  return data.attachment;
}

export async function uploadChatAttachment(
  attachment: PreparedAttachment,
  target: UploadTarget,
): Promise<ChatAttachmentPublic> {
  if (!target.chatId && !target.eveSessionId) {
    throw new Error("Cannot upload attachment before chat session exists.");
  }

  const policy = await getUploadPolicy();
  if (attachment.sizeBytes > policy.maxBytesPerFile) {
    throw new Error(
      `File exceeds the ${Math.round(policy.maxBytesPerFile / (1024 * 1024))} MB limit.`,
    );
  }

  if (shouldUseDirectBlobUpload(attachment.sizeBytes, policy)) {
    return uploadChatAttachmentViaBlob(attachment, target);
  }

  return uploadChatAttachmentViaMultipart(attachment, target);
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

/** Empty markdown placeholders for in-progress audio captures — not user uploads. */
export function isAudioCaptureTranscriptPlaceholder(
  item: Pick<ChatAttachmentPublic, "filename" | "mediaType" | "sizeBytes">,
): boolean {
  return (
    item.sizeBytes === 0 &&
    item.mediaType.toLowerCase().includes("markdown") &&
    /^audio transcript/i.test(item.filename.trim())
  );
}

export function mergeMentionAttachmentOptions(
  library: readonly ChatAttachmentPublic[],
  staged: readonly PreparedAttachment[],
  workspaceSession: readonly Pick<
    MentionAttachmentOption,
    | "id"
    | "filename"
    | "mediaType"
    | "sizeBytes"
    | "createdAt"
    | "parseStatus"
    | "parsePipelineId"
    | "parseJobId"
  >[] = [],
): MentionAttachmentOption[] {
  const options: MentionAttachmentOption[] = [];
  const seenChatIds = new Set<string>();

  for (const item of library) {
    if (isAudioCaptureTranscriptPlaceholder(item)) continue;
    if (seenChatIds.has(item.id)) continue;
    seenChatIds.add(item.id);
    options.push({
      id: item.id,
      filename: item.filename,
      mediaType: item.mediaType,
      sizeBytes: item.sizeBytes,
      createdAt: item.createdAt,
      source: "chat",
      parseStatus: item.parseStatus,
      parsePipelineId: item.parsePipelineId,
      parseJobId: item.parseJobId,
    });
  }

  for (const item of staged) {
    const id = item.platformId ?? item.id;
    if (seenChatIds.has(id)) continue;
    seenChatIds.add(id);
    options.push({
      id,
      filename: item.filename,
      mediaType: item.mediaType,
      sizeBytes: item.sizeBytes,
      createdAt: null,
      source: "chat",
    });
  }

  const seenWorkspaceIds = new Set<string>();
  for (const item of workspaceSession) {
    if (seenWorkspaceIds.has(item.id)) continue;
    seenWorkspaceIds.add(item.id);
    options.push({
      id: item.id,
      filename: item.filename,
      mediaType: item.mediaType,
      sizeBytes: item.sizeBytes,
      createdAt: item.createdAt,
      source: "workspace",
      parseStatus: item.parseStatus,
      parsePipelineId: item.parsePipelineId,
      parseJobId: item.parseJobId,
    });
  }

  return options.sort((a, b) => {
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
