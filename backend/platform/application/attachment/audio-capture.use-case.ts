import { classifyAttachment } from "../../domain/attachment/attachment-kinds.js";
import {
  toPublicAttachment,
  type ChatAttachmentPublic,
} from "../../domain/attachment/chat-attachment.entity.js";
import { ParseStatus } from "../../domain/parse/parse-status.js";
import type { ChatAttachment } from "../../domain/attachment/chat-attachment.entity.js";
import {
  addAudioCapturePart,
  countAudioCaptureParts,
  getAudioCaptureForChat,
  insertAudioCapture,
  listAudioCapturesForChat,
  setAudioCaptureOutputAttachment,
  updateAudioCaptureStatus,
  type AudioCaptureWithParts,
} from "../../infrastructure/persistence/audio/drizzle-audio-capture.repository.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import { drizzleChatRepository } from "../../infrastructure/persistence/chat/drizzle-chat.repository.js";
import { uploadChatAttachmentForUser } from "./chat-attachment.use-case.js";
import { enqueueAudioCaptureParseJob } from "./audio-capture-parse.use-case.js";
import {
  buildArtifactSpecForAudioCapture,
  buildAudioTranscriptProductTurn,
} from "../chat/build-audio-transcript-product-turn.js";
import { appendPlatformProductTurn } from "../chat/platform-product-turn.use-case.js";

const MAX_PARTS_PER_CAPTURE = 8;

async function resolveChatForAudio(input: {
  userId: string;
  chatId?: string;
  eveSessionId?: string;
  agentId?: string;
}) {
  if (input.chatId) {
    return drizzleChatRepository.getChatMetaForUser({
      userId: input.userId,
      chatId: input.chatId,
    });
  }
  if (input.eveSessionId) {
    const existing = await drizzleChatRepository.getChatByEveSessionForUser({
      userId: input.userId,
      eveSessionId: input.eveSessionId,
    });
    if (existing) return existing;
    if (!input.agentId) return null;
    return drizzleChatRepository.ensureChat({
      userId: input.userId,
      agentId: input.agentId,
      eveSessionId: input.eveSessionId,
    });
  }
  return null;
}

export type AudioCapturePublic = {
  id: string;
  chatId: string;
  title: string;
  status: string;
  outputAttachmentId: string | null;
  outputAttachment: ChatAttachmentPublic | null;
  parts: Array<{
    attachmentId: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    sortOrder: number;
  }>;
  createdAt: string;
  updatedAt: string;
};

function toPublicCapture(
  row: AudioCaptureWithParts,
  output: ChatAttachmentPublic | null,
): AudioCapturePublic {
  return {
    id: row.id,
    chatId: row.chatId,
    title: row.title,
    status: row.status,
    outputAttachmentId: row.outputAttachmentId,
    outputAttachment: output,
    parts: row.parts.map((part) => ({
      attachmentId: part.attachmentId,
      filename: part.filename,
      mediaType: part.mediaType,
      sizeBytes: part.sizeBytes,
      sortOrder: part.sortOrder,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadOutputPublic(
  chatId: string,
  outputAttachmentId: string | null,
): Promise<ChatAttachmentPublic | null> {
  if (!outputAttachmentId) return null;
  const row = await drizzleChatAttachmentRepository.getById({
    chatId,
    attachmentId: outputAttachmentId,
  });
  return row ? toPublicAttachment(row) : null;
}

/** Transcript deliverable row — created at Start, filled when parse completes. */
async function createTranscriptOutputAttachment(input: {
  chatId: string;
  captureId: string;
  title: string;
}): Promise<ChatAttachment> {
  const slug = input.title.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 60);
  const filename = `${slug}-${input.captureId.slice(0, 8)}.md`;
  const attachmentId = crypto.randomUUID();
  const storageKey = `${attachmentId}/${filename}`;
  return drizzleChatAttachmentRepository.createWithId({
    id: attachmentId,
    chatId: input.chatId,
    filename,
    mediaType: "text/markdown",
    sizeBytes: 0,
    storageKey,
    contentHash: null,
  });
}

async function ensureTranscriptOutputAttachment(
  capture: AudioCaptureWithParts,
): Promise<ChatAttachment> {
  if (capture.outputAttachmentId) {
    const existing = await drizzleChatAttachmentRepository.getById({
      chatId: capture.chatId,
      attachmentId: capture.outputAttachmentId,
    });
    if (existing) return existing;
  }
  const output = await createTranscriptOutputAttachment({
    chatId: capture.chatId,
    captureId: capture.id,
    title: capture.title,
  });
  await setAudioCaptureOutputAttachment({
    captureId: capture.id,
    outputAttachmentId: output.id,
  });
  capture.outputAttachmentId = output.id;
  return output;
}

export async function createAudioCaptureDraft(input: {
  userId: string;
  title: string;
  chatId?: string;
  eveSessionId?: string;
  agentId?: string;
}): Promise<{ capture: AudioCapturePublic | null; error?: string }> {
  if (!input.chatId && !input.eveSessionId) {
    return { capture: null, error: "chatId or eveSessionId is required." };
  }

  const chat = await resolveChatForAudio(input);
  if (!chat) {
    return { capture: null, error: "Chat not found for this session." };
  }

  const title = input.title.trim() || "Audio transcript";
  try {
    const capture = await insertAudioCapture({
      chatId: chat.id,
      title,
      outputAttachmentId: null,
      status: "draft",
    });

    const full = await getAudioCaptureForChat({
      chatId: chat.id,
      captureId: capture.id,
    });
    if (!full) return { capture: null, error: "Failed to create capture." };
    return {
      capture: toPublicCapture(full, null),
    };
  } catch (err) {
    return {
      capture: null,
      error: err instanceof Error ? err.message : "Failed to create capture.",
    };
  }
}

export async function addAudioCapturePartFile(input: {
  userId: string;
  chatId: string;
  captureId: string;
  filename: string;
  mediaType: string;
  bytes: Uint8Array;
}): Promise<{ capture: AudioCapturePublic | null; error?: string }> {
  const capture = await getAudioCaptureForChat({
    chatId: input.chatId,
    captureId: input.captureId,
  });
  if (!capture) return { capture: null, error: "Capture not found." };
  if (capture.status !== "draft") {
    return { capture: null, error: "Capture is no longer editable." };
  }
  const partCount = await countAudioCaptureParts(capture.id);
  if (partCount >= MAX_PARTS_PER_CAPTURE) {
    return {
      capture: null,
      error: `At most ${MAX_PARTS_PER_CAPTURE} audio files per capture.`,
    };
  }

  let kind;
  try {
    kind = classifyAttachment({
      filename: input.filename,
      mimeType: input.mediaType,
    });
  } catch {
    return { capture: null, error: "Unsupported file type." };
  }
  if (kind !== "audio") {
    return { capture: null, error: "Only audio files can be added to a capture." };
  }

  const chat = await drizzleChatRepository.getChatMetaForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) return { capture: null, error: "Chat not found." };

  const uploaded = await uploadChatAttachmentForUser({
    userId: input.userId,
    agentId: chat.agentId,
    chatId: input.chatId,
    filename: input.filename,
    mediaType: input.mediaType,
    bytes: input.bytes,
    enqueueParse: false,
  });
  if (!uploaded.attachment) {
    return { capture: null, error: uploaded.error ?? "Upload failed." };
  }

  await addAudioCapturePart({
    captureId: capture.id,
    attachmentId: uploaded.attachment.id,
    sortOrder: partCount,
  });

  const full = await getAudioCaptureForChat({
    chatId: input.chatId,
    captureId: capture.id,
  });
  if (!full) return { capture: null, error: "Capture not found." };
  const output = await loadOutputPublic(full.chatId, full.outputAttachmentId);
  return { capture: toPublicCapture(full, output) };
}

export async function addAudioCapturePartFromAttachment(input: {
  userId: string;
  chatId: string;
  captureId: string;
  attachmentId: string;
}): Promise<{ capture: AudioCapturePublic | null; error?: string }> {
  const capture = await getAudioCaptureForChat({
    chatId: input.chatId,
    captureId: input.captureId,
  });
  if (!capture) return { capture: null, error: "Capture not found." };
  if (capture.status !== "draft") {
    return { capture: null, error: "Capture is no longer editable." };
  }
  const partCount = await countAudioCaptureParts(capture.id);
  if (partCount >= MAX_PARTS_PER_CAPTURE) {
    return {
      capture: null,
      error: `At most ${MAX_PARTS_PER_CAPTURE} audio files per capture.`,
    };
  }

  const chat = await drizzleChatRepository.getChatMetaForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) return { capture: null, error: "Chat not found." };

  const attachment = await drizzleChatAttachmentRepository.getById({
    chatId: chat.id,
    attachmentId: input.attachmentId,
  });
  if (!attachment) {
    return { capture: null, error: "Attachment not found in this chat." };
  }

  let kind;
  try {
    kind = classifyAttachment({
      filename: attachment.filename,
      mimeType: attachment.mediaType,
    });
  } catch {
    return { capture: null, error: "Unsupported file type." };
  }
  if (kind !== "audio") {
    return { capture: null, error: "Only audio files can be added to a capture." };
  }

  const alreadyLinked = capture.parts.some(
    (part) => part.attachmentId === attachment.id,
  );
  if (!alreadyLinked) {
    await addAudioCapturePart({
      captureId: capture.id,
      attachmentId: attachment.id,
      sortOrder: partCount,
    });
  }

  const full = await getAudioCaptureForChat({
    chatId: input.chatId,
    captureId: capture.id,
  });
  if (!full) return { capture: null, error: "Capture not found." };
  const output = await loadOutputPublic(full.chatId, full.outputAttachmentId);
  return { capture: toPublicCapture(full, output) };
}

export async function startAudioCaptureTranscription(input: {
  userId: string;
  chatId: string;
  captureId: string;
}): Promise<{ capture: AudioCapturePublic | null; error?: string }> {
  const capture = await getAudioCaptureForChat({
    chatId: input.chatId,
    captureId: input.captureId,
  });
  if (!capture) return { capture: null, error: "Capture not found." };
  if (capture.parts.length === 0) {
    return { capture: null, error: "Add at least one audio file." };
  }
  if (capture.status === "transcribing") {
    return { capture: null, error: "Transcription is already running." };
  }

  const chat = await drizzleChatRepository.getChatMetaForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) return { capture: null, error: "Chat not found." };

  let outputRow: ChatAttachment;
  try {
    outputRow = await ensureTranscriptOutputAttachment(capture);
  } catch (err) {
    return {
      capture: null,
      error: err instanceof Error ? err.message : "Failed to prepare transcript output.",
    };
  }

  try {
    await enqueueAudioCaptureParseJob({
      capture,
      outputRow,
    });
    await updateAudioCaptureStatus(capture.id, "transcribing");
  } catch (err) {
    await updateAudioCaptureStatus(capture.id, "failed");
    return {
      capture: null,
      error: err instanceof Error ? err.message : "Failed to start transcription.",
    };
  }

  const full = await getAudioCaptureForChat({
    chatId: input.chatId,
    captureId: capture.id,
  });
  if (!full) return { capture: null, error: "Capture not found." };
  const outputPublic = await loadOutputPublic(
    full.chatId,
    full.outputAttachmentId ?? outputRow.id,
  );
  const publicCapture = toPublicCapture(
    { ...full, outputAttachmentId: full.outputAttachmentId ?? outputRow.id },
    outputPublic,
  );

  try {
    const spec = buildArtifactSpecForAudioCapture(publicCapture);
    const bundle = buildAudioTranscriptProductTurn({
      capture: publicCapture,
      artifactSpec: spec,
    });
    await appendPlatformProductTurn({
      userId: input.userId,
      chatId: input.chatId,
      bundle,
      product: "audio_transcript",
      instanceId: capture.id,
    });
  } catch (err) {
    console.warn("[audio-capture] platform product turn append failed", {
      captureId: capture.id,
      error: err instanceof Error ? err.message : err,
    });
  }

  return { capture: publicCapture };
}

export async function listAudioCapturesForUser(input: {
  userId: string;
  chatId?: string;
  eveSessionId?: string;
  agentId?: string;
}): Promise<AudioCapturePublic[]> {
  const chat = await resolveChatForAudio(input);
  if (!chat) return [];
  const rows = await listAudioCapturesForChat(chat.id);
  const result: AudioCapturePublic[] = [];
  for (const row of rows) {
    const output = await loadOutputPublic(row.chatId, row.outputAttachmentId);
    if (
      row.status === "transcribing" &&
      output &&
      (output.parseStatus === ParseStatus.READY ||
        output.parseStatus === ParseStatus.FAILED)
    ) {
      const nextStatus =
        output.parseStatus === ParseStatus.READY ? "ready" : "failed";
      await updateAudioCaptureStatus(row.id, nextStatus);
      row.status = nextStatus;
    }
    result.push(toPublicCapture(row, output));
  }
  return result;
}

export async function retryAudioCaptureTranscription(input: {
  userId: string;
  chatId: string;
  captureId: string;
}): Promise<{ capture: AudioCapturePublic | null; error?: string }> {
  const capture = await getAudioCaptureForChat({
    chatId: input.chatId,
    captureId: input.captureId,
  });
  if (!capture) return { capture: null, error: "Capture not found." };
  await updateAudioCaptureStatus(capture.id, "draft");
  return startAudioCaptureTranscription(input);
}

export async function getAudioCaptureTranscriptMarkdown(input: {
  userId: string;
  chatId: string;
  captureId: string;
}): Promise<{ markdown: string | null; filename: string | null; error?: string }> {
  const capture = await getAudioCaptureForChat({
    chatId: input.chatId,
    captureId: input.captureId,
  });
  if (!capture) return { markdown: null, filename: null, error: "Capture not found." };
  const chat = await drizzleChatRepository.getChatMetaForUser({
    userId: input.userId,
    chatId: input.chatId,
  });
  if (!chat) return { markdown: null, filename: null, error: "Chat not found." };

  const { loadParsedArtifact } = await import(
    "../../infrastructure/attachment/parsed-artifact-storage.js"
  );
  if (!capture.outputAttachmentId) {
    return { markdown: null, filename: null, error: "Transcript not ready." };
  }
  const raw = await loadParsedArtifact(
    chat.id,
    capture.outputAttachmentId,
    "content_md",
  );
  if (!raw?.byteLength) {
    return { markdown: null, filename: null, error: "Transcript not ready." };
  }
  const output = await drizzleChatAttachmentRepository.getById({
    chatId: chat.id,
    attachmentId: capture.outputAttachmentId,
  });
  return {
    markdown: new TextDecoder().decode(raw),
    filename: output?.filename ?? "transcript.md",
  };
}
