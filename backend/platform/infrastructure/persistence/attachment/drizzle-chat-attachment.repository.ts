import { and, asc, eq } from "drizzle-orm";
import type { ChatAttachmentRepository } from "../../../domain/attachment/chat-attachment.repository";
import type { ChatAttachment } from "../../../domain/attachment/chat-attachment.entity";
import {
  chatAttachments,
  getDb,
  type ChatAttachmentRow,
} from "../database";

function toDomain(row: ChatAttachmentRow): ChatAttachment {
  return {
    id: row.id,
    chatId: row.chatId,
    filename: row.filename,
    mediaType: row.mediaType,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    createdAt: row.createdAt,
  };
}

export class DrizzleChatAttachmentRepository implements ChatAttachmentRepository {
  async upsert(input: {
    chatId: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    storageKey: string;
  }): Promise<ChatAttachment> {
    const db = requireDb();
    const existing = await db.query.chatAttachments.findFirst({
      where: and(
        eq(chatAttachments.chatId, input.chatId),
        eq(chatAttachments.filename, input.filename),
      ),
    });

    if (existing) {
      const [row] = await db
        .update(chatAttachments)
        .set({
          mediaType: input.mediaType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
        })
        .where(eq(chatAttachments.id, existing.id))
        .returning();
      return toDomain(row);
    }

    const [row] = await db
      .insert(chatAttachments)
      .values({
        chatId: input.chatId,
        filename: input.filename,
        mediaType: input.mediaType,
        sizeBytes: input.sizeBytes,
        storageKey: input.storageKey,
      })
      .returning();
    return toDomain(row);
  }

  async listByChatId(chatId: string): Promise<ChatAttachment[]> {
    const db = requireDb();
    const rows = await db
      .select()
      .from(chatAttachments)
      .where(eq(chatAttachments.chatId, chatId))
      .orderBy(asc(chatAttachments.createdAt));
    return rows.map(toDomain);
  }

  async getById(input: {
    chatId: string;
    attachmentId: string;
  }): Promise<ChatAttachment | null> {
    const db = requireDb();
    const row = await db.query.chatAttachments.findFirst({
      where: and(
        eq(chatAttachments.chatId, input.chatId),
        eq(chatAttachments.id, input.attachmentId),
      ),
    });
    return row ? toDomain(row) : null;
  }

  async findByFilename(input: {
    chatId: string;
    filename: string;
  }): Promise<ChatAttachment | null> {
    const db = requireDb();
    const exact = await db.query.chatAttachments.findFirst({
      where: and(
        eq(chatAttachments.chatId, input.chatId),
        eq(chatAttachments.filename, input.filename),
      ),
    });
    if (exact) return toDomain(exact);

    const rows = await this.listByChatId(input.chatId);
    const target = input.filename.trim().toLowerCase();
    const match = rows.find(
      (item) => item.filename.trim().toLowerCase() === target,
    );
    return match ?? null;
  }

  async deleteById(input: {
    chatId: string;
    attachmentId: string;
  }): Promise<boolean> {
    const db = requireDb();
    const [row] = await db
      .delete(chatAttachments)
      .where(
        and(
          eq(chatAttachments.chatId, input.chatId),
          eq(chatAttachments.id, input.attachmentId),
        ),
      )
      .returning({ id: chatAttachments.id });
    return Boolean(row);
  }
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}

export const drizzleChatAttachmentRepository =
  new DrizzleChatAttachmentRepository();
