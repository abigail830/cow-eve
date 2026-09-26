import { and, asc, eq } from "drizzle-orm";
import type { ChatAttachmentRepository } from "../../../domain/attachment/chat-attachment.repository";
import type { ChatAttachment } from "../../../domain/attachment/chat-attachment.entity";
import { mergeParsedArtifactRecord } from "../../../domain/docstore/parsed-manifest.js";
import { ParseStatus } from "../../../domain/parse/parse-status.js";
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
    contentHash: row.contentHash ?? null,
    parseStatus: row.parseStatus,
    parsePipelineId: row.parsePipelineId ?? null,
    parseJobId: row.parseJobId ?? null,
    parseErrorCode: row.parseErrorCode ?? null,
    parseErrorMessage: row.parseErrorMessage ?? null,
    parseStageSnapshot: (row.parseStageSnapshot as Record<string, unknown>) ?? null,
    parsedArtifactManifest:
      (row.parsedArtifactManifest as Record<string, unknown>) ?? null,
    gist: row.gist ?? null,
    gistContentSha256: row.gistContentSha256 ?? null,
    gistGeneratedAt: row.gistGeneratedAt ?? null,
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
    contentHash?: string | null;
    parseStatus?: string;
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
          contentHash: input.contentHash ?? null,
          ...(input.parseStatus ? { parseStatus: input.parseStatus } : {}),
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
        contentHash: input.contentHash ?? null,
        parseStatus: input.parseStatus ?? ParseStatus.READY,
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

  async getByIdOnly(attachmentId: string): Promise<ChatAttachment | null> {
    const db = requireDb();
    const row = await db.query.chatAttachments.findFirst({
      where: eq(chatAttachments.id, attachmentId),
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

  async markParseReady(
    attachmentId: string,
    input: { pipelineId?: string | null; skipped?: boolean },
  ): Promise<ChatAttachment | null> {
    const db = requireDb();
    const [row] = await db
      .update(chatAttachments)
      .set({
        parseStatus: input.skipped ? ParseStatus.SKIPPED : ParseStatus.READY,
        parsePipelineId: input.pipelineId ?? null,
        parseJobId: null,
        parseErrorCode: null,
        parseErrorMessage: null,
        parseStageSnapshot: null,
        parsedArtifactManifest: null,
      })
      .where(eq(chatAttachments.id, attachmentId))
      .returning();
    return row ? toDomain(row) : null;
  }

  async markParsePending(
    attachmentId: string,
    input: { pipelineId: string; jobId: string },
  ): Promise<ChatAttachment | null> {
    const db = requireDb();
    const [row] = await db
      .update(chatAttachments)
      .set({
        parseStatus: ParseStatus.PENDING,
        parsePipelineId: input.pipelineId,
        parseJobId: input.jobId,
        parseErrorCode: null,
        parseErrorMessage: null,
        parseStageSnapshot: null,
        parsedArtifactManifest: null,
      })
      .where(eq(chatAttachments.id, attachmentId))
      .returning();
    return row ? toDomain(row) : null;
  }

  async applyParseWebhook(
    attachmentId: string,
    input: {
      status: string;
      stageSnapshot?: Record<string, unknown> | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ): Promise<ChatAttachment | null> {
    const db = requireDb();
    const [row] = await db
      .update(chatAttachments)
      .set({
        parseStatus: input.status,
        ...(input.stageSnapshot !== undefined
          ? { parseStageSnapshot: input.stageSnapshot }
          : {}),
        ...(input.errorCode !== undefined
          ? { parseErrorCode: input.errorCode }
          : {}),
        ...(input.errorMessage !== undefined
          ? { parseErrorMessage: input.errorMessage }
          : {}),
      })
      .where(eq(chatAttachments.id, attachmentId))
      .returning();
    return row ? toDomain(row) : null;
  }

  async saveGist(
    attachmentId: string,
    input: { gist: string; gistContentSha256: string },
  ): Promise<ChatAttachment | null> {
    const db = requireDb();
    const [row] = await db
      .update(chatAttachments)
      .set({
        gist: input.gist,
        gistContentSha256: input.gistContentSha256,
        gistGeneratedAt: new Date(),
      })
      .where(eq(chatAttachments.id, attachmentId))
      .returning();
    return row ? toDomain(row) : null;
  }

  async recordParsedArtifactsBatch(
    attachmentId: string,
    input: {
      chatId: string;
      artifacts: Array<{
        artifactKey: string;
        sizeBytes: number;
        contentType: string;
      }>;
    },
  ): Promise<ChatAttachment | null> {
    const row = await this.getByIdOnly(attachmentId);
    if (!row || row.chatId !== input.chatId) return null;
    let manifest = row.parsedArtifactManifest;
    for (const artifact of input.artifacts) {
      manifest = mergeParsedArtifactRecord(manifest, {
        chatId: input.chatId,
        attachmentId,
        artifactKey: artifact.artifactKey,
        sizeBytes: artifact.sizeBytes,
        contentType: artifact.contentType,
      });
    }
    const db = requireDb();
    const [updated] = await db
      .update(chatAttachments)
      .set({ parsedArtifactManifest: manifest })
      .where(eq(chatAttachments.id, attachmentId))
      .returning();
    return updated ? toDomain(updated) : null;
  }
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}

export const drizzleChatAttachmentRepository =
  new DrizzleChatAttachmentRepository();
