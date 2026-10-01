import { and, asc, eq, inArray } from "drizzle-orm";
import { mergeParsedArtifactRecord } from "../../../domain/docstore/parsed-manifest.js";
import type {
  WorkspaceFile,
  WorkspaceFolder,
} from "../../../domain/workspace/workspace-file.entity.js";
import { ParseStatus } from "../../../domain/parse/parse-status.js";
import {
  getDb,
  workspaceFiles,
  workspaceFolders,
  type WorkspaceFileRow,
  type WorkspaceFolderRow,
} from "../database";

function toFolder(row: WorkspaceFolderRow): WorkspaceFolder {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toFile(row: WorkspaceFileRow): WorkspaceFile {
  return {
    id: row.id,
    userId: row.userId,
    folderId: row.folderId,
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
    parseStageSnapshot:
      (row.parseStageSnapshot as Record<string, unknown>) ?? null,
    parsedArtifactManifest:
      (row.parsedArtifactManifest as Record<string, unknown>) ?? null,
    gist: row.gist ?? null,
    gistContentSha256: row.gistContentSha256 ?? null,
    gistGeneratedAt: row.gistGeneratedAt ?? null,
    createdAt: row.createdAt,
  };
}

export class DrizzleWorkspaceRepository {
  async listFolders(userId: string): Promise<WorkspaceFolder[]> {
    const db = requireDb();
    const rows = await db
      .select()
      .from(workspaceFolders)
      .where(eq(workspaceFolders.userId, userId))
      .orderBy(asc(workspaceFolders.name));
    return rows.map(toFolder);
  }

  async createFolder(input: {
    userId: string;
    name: string;
  }): Promise<WorkspaceFolder> {
    const db = requireDb();
    const [row] = await db
      .insert(workspaceFolders)
      .values({
        userId: input.userId,
        name: input.name.trim(),
        updatedAt: new Date(),
      })
      .returning();
    return toFolder(row);
  }

  async getFolderForUser(input: {
    userId: string;
    folderId: string;
  }): Promise<WorkspaceFolder | null> {
    const db = requireDb();
    const row = await db.query.workspaceFolders.findFirst({
      where: and(
        eq(workspaceFolders.id, input.folderId),
        eq(workspaceFolders.userId, input.userId),
      ),
    });
    return row ? toFolder(row) : null;
  }

  async renameFolder(input: {
    userId: string;
    folderId: string;
    name: string;
  }): Promise<WorkspaceFolder | null> {
    const db = requireDb();
    const [row] = await db
      .update(workspaceFolders)
      .set({ name: input.name.trim(), updatedAt: new Date() })
      .where(
        and(
          eq(workspaceFolders.id, input.folderId),
          eq(workspaceFolders.userId, input.userId),
        ),
      )
      .returning();
    return row ? toFolder(row) : null;
  }

  async deleteFolder(input: {
    userId: string;
    folderId: string;
  }): Promise<boolean> {
    const db = requireDb();
    const files = await db
      .select({ id: workspaceFiles.id })
      .from(workspaceFiles)
      .where(eq(workspaceFiles.folderId, input.folderId))
      .limit(1);
    if (files.length > 0) return false;

    const [row] = await db
      .delete(workspaceFolders)
      .where(
        and(
          eq(workspaceFolders.id, input.folderId),
          eq(workspaceFolders.userId, input.userId),
        ),
      )
      .returning({ id: workspaceFolders.id });
    return Boolean(row);
  }

  async listFilesInFolder(input: {
    userId: string;
    folderId: string;
  }): Promise<WorkspaceFile[]> {
    const db = requireDb();
    const rows = await db
      .select()
      .from(workspaceFiles)
      .where(
        and(
          eq(workspaceFiles.folderId, input.folderId),
          eq(workspaceFiles.userId, input.userId),
        ),
      )
      .orderBy(asc(workspaceFiles.createdAt));
    return rows.map(toFile);
  }

  async createFile(input: {
    id: string;
    userId: string;
    folderId: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
    storageKey: string;
    contentHash?: string | null;
  }): Promise<WorkspaceFile> {
    const db = requireDb();
    const [row] = await db
      .insert(workspaceFiles)
      .values({
        id: input.id,
        userId: input.userId,
        folderId: input.folderId,
        filename: input.filename,
        mediaType: input.mediaType,
        sizeBytes: input.sizeBytes,
        storageKey: input.storageKey,
        contentHash: input.contentHash ?? null,
        parseStatus: ParseStatus.READY,
      })
      .returning();
    return toFile(row);
  }

  async listFilesByIdsForUser(input: {
    userId: string;
    fileIds: readonly string[];
  }): Promise<WorkspaceFile[]> {
    const ids = [...new Set(input.fileIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) return [];
    const db = requireDb();
    const rows = await db
      .select()
      .from(workspaceFiles)
      .where(
        and(
          eq(workspaceFiles.userId, input.userId),
          inArray(workspaceFiles.id, ids),
        ),
      );
    return rows.map(toFile);
  }

  async getFileForUser(input: {
    userId: string;
    fileId: string;
  }): Promise<WorkspaceFile | null> {
    const db = requireDb();
    const row = await db.query.workspaceFiles.findFirst({
      where: and(
        eq(workspaceFiles.id, input.fileId),
        eq(workspaceFiles.userId, input.userId),
      ),
    });
    return row ? toFile(row) : null;
  }

  async getFileByIdOnly(fileId: string): Promise<WorkspaceFile | null> {
    const db = requireDb();
    const row = await db.query.workspaceFiles.findFirst({
      where: eq(workspaceFiles.id, fileId),
    });
    return row ? toFile(row) : null;
  }

  async deleteFile(input: {
    userId: string;
    fileId: string;
  }): Promise<boolean> {
    const db = requireDb();
    const [row] = await db
      .delete(workspaceFiles)
      .where(
        and(
          eq(workspaceFiles.id, input.fileId),
          eq(workspaceFiles.userId, input.userId),
        ),
      )
      .returning({ id: workspaceFiles.id });
    return Boolean(row);
  }

  async markParsePending(
    fileId: string,
    input: { pipelineId: string; jobId: string },
  ): Promise<WorkspaceFile | null> {
    const db = requireDb();
    const [row] = await db
      .update(workspaceFiles)
      .set({
        parseStatus: ParseStatus.PENDING,
        parsePipelineId: input.pipelineId,
        parseJobId: input.jobId,
        parseErrorCode: null,
        parseErrorMessage: null,
        parseStageSnapshot: null,
        parsedArtifactManifest: null,
      })
      .where(eq(workspaceFiles.id, fileId))
      .returning();
    return row ? toFile(row) : null;
  }

  async markParseReady(
    fileId: string,
    input: { pipelineId?: string | null; skipped?: boolean },
  ): Promise<WorkspaceFile | null> {
    const db = requireDb();
    const [row] = await db
      .update(workspaceFiles)
      .set({
        parseStatus: input.skipped ? ParseStatus.SKIPPED : ParseStatus.READY,
        parsePipelineId: input.pipelineId ?? null,
        parseJobId: null,
        parseErrorCode: null,
        parseErrorMessage: null,
        parseStageSnapshot: null,
        parsedArtifactManifest: null,
      })
      .where(eq(workspaceFiles.id, fileId))
      .returning();
    return row ? toFile(row) : null;
  }

  async applyParseWebhook(
    fileId: string,
    input: {
      status: string;
      stageSnapshot?: Record<string, unknown> | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ): Promise<WorkspaceFile | null> {
    const db = requireDb();
    const [row] = await db
      .update(workspaceFiles)
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
      .where(eq(workspaceFiles.id, fileId))
      .returning();
    return row ? toFile(row) : null;
  }

  async recordParsedArtifactsBatch(
    fileId: string,
    input: {
      scopeId: string;
      artifacts: Array<{
        artifactKey: string;
        sizeBytes: number;
        contentType: string;
      }>;
    },
  ): Promise<WorkspaceFile | null> {
    const row = await this.getFileByIdOnly(fileId);
    if (!row) return null;
    let manifest = row.parsedArtifactManifest;
    for (const artifact of input.artifacts) {
      manifest = mergeParsedArtifactRecord(manifest, {
        chatId: input.scopeId,
        attachmentId: fileId,
        artifactKey: artifact.artifactKey,
        sizeBytes: artifact.sizeBytes,
        contentType: artifact.contentType,
      });
    }
    const db = requireDb();
    const [updated] = await db
      .update(workspaceFiles)
      .set({ parsedArtifactManifest: manifest })
      .where(eq(workspaceFiles.id, fileId))
      .returning();
    return updated ? toFile(updated) : null;
  }

  async saveGist(
    fileId: string,
    input: { gist: string; gistContentSha256: string },
  ): Promise<WorkspaceFile | null> {
    const db = requireDb();
    const [row] = await db
      .update(workspaceFiles)
      .set({
        gist: input.gist,
        gistContentSha256: input.gistContentSha256,
        gistGeneratedAt: new Date(),
      })
      .where(eq(workspaceFiles.id, fileId))
      .returning();
    return row ? toFile(row) : null;
  }
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}

export const drizzleWorkspaceRepository = new DrizzleWorkspaceRepository();
