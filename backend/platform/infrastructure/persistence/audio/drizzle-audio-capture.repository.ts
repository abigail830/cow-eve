import { and, asc, desc, eq } from "drizzle-orm";
import {
  audioCaptureParts,
  audioCaptures,
  chatAttachments,
  getDb,
  requireDb,
  type AudioCaptureRow,
} from "../database";

export type AudioCapturePartRow = {
  attachmentId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  sortOrder: number;
};

export type AudioCaptureWithParts = AudioCaptureRow & {
  parts: AudioCapturePartRow[];
};

export async function insertAudioCapture(input: {
  chatId: string;
  title: string;
  outputAttachmentId?: string | null;
  status?: string;
}): Promise<AudioCaptureRow> {
  const db = requireDb();
  const [row] = await db
    .insert(audioCaptures)
    .values({
      chatId: input.chatId,
      title: input.title,
      outputAttachmentId: input.outputAttachmentId ?? null,
      status: input.status ?? "draft",
    })
    .returning();
  return row;
}

export async function setAudioCaptureOutputAttachment(input: {
  captureId: string;
  outputAttachmentId: string;
}): Promise<void> {
  const db = requireDb();
  await db
    .update(audioCaptures)
    .set({
      outputAttachmentId: input.outputAttachmentId,
      updatedAt: new Date(),
    })
    .where(eq(audioCaptures.id, input.captureId));
}

export async function addAudioCapturePart(input: {
  captureId: string;
  attachmentId: string;
  sortOrder: number;
}): Promise<void> {
  const db = requireDb();
  await db.insert(audioCaptureParts).values({
    captureId: input.captureId,
    attachmentId: input.attachmentId,
    sortOrder: input.sortOrder,
  });
}

export async function updateAudioCaptureStatus(
  captureId: string,
  status: string,
): Promise<void> {
  const db = requireDb();
  await db
    .update(audioCaptures)
    .set({ status, updatedAt: new Date() })
    .where(eq(audioCaptures.id, captureId));
}

export async function getAudioCaptureForChat(input: {
  chatId: string;
  captureId: string;
}): Promise<AudioCaptureWithParts | null> {
  const db = getDb();
  if (!db) return null;
  const capture = await db.query.audioCaptures.findFirst({
    where: and(
      eq(audioCaptures.id, input.captureId),
      eq(audioCaptures.chatId, input.chatId),
    ),
  });
  if (!capture) return null;
  const parts = await listCaptureParts(capture.id);
  return { ...capture, parts };
}

export async function listAudioCapturesForChat(
  chatId: string,
): Promise<AudioCaptureWithParts[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.query.audioCaptures.findMany({
    where: eq(audioCaptures.chatId, chatId),
    orderBy: desc(audioCaptures.createdAt),
  });
  const result: AudioCaptureWithParts[] = [];
  for (const capture of rows) {
    result.push({
      ...capture,
      parts: await listCaptureParts(capture.id),
    });
  }
  return result;
}

async function listCaptureParts(captureId: string): Promise<AudioCapturePartRow[]> {
  const db = requireDb();
  const links = await db.query.audioCaptureParts.findMany({
    where: eq(audioCaptureParts.captureId, captureId),
    orderBy: asc(audioCaptureParts.sortOrder),
  });
  const parts: AudioCapturePartRow[] = [];
  for (const link of links) {
    const attachment = await db.query.chatAttachments.findFirst({
      where: eq(chatAttachments.id, link.attachmentId),
    });
    if (!attachment) continue;
    parts.push({
      attachmentId: attachment.id,
      filename: attachment.filename,
      mediaType: attachment.mediaType,
      sizeBytes: attachment.sizeBytes,
      sortOrder: link.sortOrder,
    });
  }
  return parts;
}

export async function countAudioCaptureParts(captureId: string): Promise<number> {
  const db = requireDb();
  const links = await db.query.audioCaptureParts.findMany({
    where: eq(audioCaptureParts.captureId, captureId),
  });
  return links.length;
}
