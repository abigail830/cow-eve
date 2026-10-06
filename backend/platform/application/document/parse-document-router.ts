import type { DocumentSourceKind } from "../../domain/document/document-scope.js";
import type { ParseableFile } from "../../domain/document/parseable-file.js";
import {
  parseableFromChatAttachment,
  parseableFromWorkspaceFile,
} from "../../domain/document/parseable-file.js";
import { workspaceLibraryId } from "../../domain/document/document-scope.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import { drizzleWorkspaceRepository } from "../../infrastructure/persistence/workspace/drizzle-workspace.repository.js";
import type { ParseJobRun } from "../../infrastructure/persistence/parse/drizzle-parse-job.repository.js";

export async function resolveParseableFile(
  run: ParseJobRun,
): Promise<ParseableFile | null> {
  if (run.sourceKind === "workspace_file") {
    const row = await drizzleWorkspaceRepository.getFileByIdOnly(run.attachmentId);
    if (!row) return null;
    return parseableFromWorkspaceFile(row, row.userId);
  }
  const row = await drizzleChatAttachmentRepository.getByIdOnly(run.attachmentId);
  if (!row) return null;
  return parseableFromChatAttachment(row);
}

export async function applyParseWebhookForRun(
  run: ParseJobRun,
  input: {
    status: string;
    stageSnapshot?: Record<string, unknown> | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  if (run.sourceKind === "workspace_file") {
    await drizzleWorkspaceRepository.applyParseWebhook(run.attachmentId, input);
    return;
  }
  await drizzleChatAttachmentRepository.applyParseWebhook(run.attachmentId, input);
}

export async function recordParsedArtifactsForRun(
  run: ParseJobRun,
  artifacts: Array<{
    artifactKey: string;
    sizeBytes: number;
    contentType: string;
  }>,
): Promise<boolean> {
  const workspaceRow = await drizzleWorkspaceRepository.getFileByIdOnly(
    run.attachmentId,
  );
  if (workspaceRow || run.sourceKind === "workspace_file") {
    const updated = await drizzleWorkspaceRepository.recordParsedArtifactsBatch(
      run.attachmentId,
      { scopeId: run.scopeId, artifacts },
    );
    return Boolean(updated);
  }
  const updated = await drizzleChatAttachmentRepository.recordParsedArtifactsBatch(
    run.attachmentId,
    { chatId: run.scopeId, artifacts },
  );
  return Boolean(updated);
}

export function sourceKindFromRun(run: ParseJobRun): DocumentSourceKind {
  return run.sourceKind === "workspace_file" ? "workspace_file" : "chat_attachment";
}

export function scopeIdForWorkspaceUser(userId: string): string {
  return workspaceLibraryId(userId);
}
