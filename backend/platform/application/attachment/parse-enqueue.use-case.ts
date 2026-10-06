import { createHash } from "node:crypto";
import {
  classifyAttachment,
  type AttachmentKind,
} from "../../domain/attachment/attachment-kinds.js";
import type { ChatAttachment } from "../../domain/attachment/chat-attachment.entity.js";
import {
  parseableFromChatAttachment,
  type ParseableFile,
} from "../../domain/document/parseable-file.js";
import type { WorkspaceFile } from "../../domain/workspace/workspace-file.entity.js";
import {
  parseableFromWorkspaceFile,
} from "../../domain/document/parseable-file.js";
import { emailDerivedMaterializationIncomplete } from "./email-derived.use-case.js";
import { parsedArtifactInManifest } from "../../domain/docstore/parsed-manifest.js";
import { ParseStatus } from "../../domain/parse/parse-status.js";
import {
  getGithubRepo,
  getGithubToken,
  getGithubWorkflowFile,
  getParsePipelineDispatchMode,
  getParsePipelinePublicBaseUrl,
  getParsePipelineServiceApiKey,
  getParsePipelineServiceUrl,
  isVercelRuntime,
} from "../../infrastructure/config/parse-pipeline.config.js";
import { dispatchParseGha } from "../../infrastructure/parse-pipeline/dispatch-gha.js";
import { dispatchParseService } from "../../infrastructure/parse-pipeline/dispatch-service.js";
import { scheduleGhaRunWatch } from "../../infrastructure/parse-pipeline/gha-watch.js";
import { resolvePipeline } from "../../infrastructure/parse-pipeline/router.js";
import {
  buildJobPayload,
  hashRunToken,
  newJobId,
  newWebhookSecret,
  runExpiresAt,
} from "../../infrastructure/parse-pipeline/job-builder.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import { drizzleWorkspaceRepository } from "../../infrastructure/persistence/workspace/drizzle-workspace.repository.js";
import { createParseJobRun } from "../../infrastructure/persistence/parse/drizzle-parse-job.repository.js";

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertParseDispatchConfigured(
  mode: ReturnType<typeof getParsePipelineDispatchMode>,
): void {
  if (mode === "service" && isVercelRuntime()) {
    if (!getParsePipelineServiceApiKey()) {
      throw new Error(
        "On Vercel, PARSE_PIPELINE_DISPATCH=service requires PARSE_PIPELINE_SERVICE_API_KEY. " +
          "Use PARSE_PIPELINE_DISPATCH=gha with GITHUB_TOKEN, GITHUB_REPO, and a public backend URL instead.",
      );
    }
    const serviceUrl = getParsePipelineServiceUrl();
    if (/127\.0\.0\.1|localhost/i.test(serviceUrl)) {
      throw new Error(
        "On Vercel, PARSE_PIPELINE_SERVICE_URL cannot be localhost. " +
          "Set PARSE_PIPELINE_DISPATCH=gha and configure GITHUB_TOKEN + GITHUB_REPO.",
      );
    }
  }
  if (mode === "gha") {
    if (!getGithubToken() || !getGithubRepo()) {
      throw new Error(
        "GITHUB_TOKEN and GITHUB_REPO are required when using GHA parse dispatch (set PARSE_PIPELINE_DISPATCH=gha on Vercel).",
      );
    }
    if (!getParsePipelinePublicBaseUrl()) {
      throw new Error(
        "PARSE_PIPELINE_PUBLIC_BASE_URL (or Vercel host injection) is required for GHA parse dispatch.",
      );
    }
  }
}

function chatAttachmentParseAlreadyComplete(
  row: ChatAttachment,
  pipelineId: string,
): boolean {
  if (row.parseStatus === ParseStatus.SKIPPED) return true;
  if (row.parseStatus !== ParseStatus.READY) return false;
  if (row.parsePipelineId !== pipelineId) return false;
  return (
    parsedArtifactInManifest(row.parsedArtifactManifest, "content_md") ||
    parsedArtifactInManifest(row.parsedArtifactManifest, "meta_json")
  );
}

function workspaceFileParseAlreadyComplete(
  row: WorkspaceFile,
  pipelineId: string,
): boolean {
  if (row.parseStatus === ParseStatus.SKIPPED) return true;
  if (row.parseStatus !== ParseStatus.READY) return false;
  if (row.parsePipelineId !== pipelineId) return false;
  return (
    parsedArtifactInManifest(row.parsedArtifactManifest, "content_md") ||
    parsedArtifactInManifest(row.parsedArtifactManifest, "meta_json")
  );
}

export async function markChatAttachmentParseStartFailed(
  attachmentId: string,
  message: string,
): Promise<ChatAttachment | null> {
  return drizzleChatAttachmentRepository.applyParseWebhook(attachmentId, {
    status: ParseStatus.FAILED,
    errorCode: "PARSE_START_FAILED",
    errorMessage: message,
  });
}

export async function finalizeAttachmentParse(
  row: ChatAttachment,
  kind: AttachmentKind,
): Promise<ChatAttachment> {
  const resolution = resolvePipeline(kind);
  if (resolution.action === "skip") {
    const updated = await drizzleChatAttachmentRepository.markParseReady(
      row.id,
      { skipped: true },
    );
    return updated ?? row;
  }
  if (resolution.action === "reject") {
    throw new Error(`Unsupported file type for parse: ${row.mediaType}`);
  }
  const derivedIncomplete =
    resolution.pipelineId === "email_standard" &&
    (await emailDerivedMaterializationIncomplete(row.chatId, row.id));
  if (
    resolution.pipelineId === "email_standard" &&
    row.parseStatus === ParseStatus.FAILED &&
    !derivedIncomplete &&
    parsedArtifactInManifest(row.parsedArtifactManifest, "content_md")
  ) {
    const updated = await drizzleChatAttachmentRepository.markParseReady(row.id, {
      pipelineId: resolution.pipelineId,
    });
    return updated ?? row;
  }
  if (row.parseStatus !== ParseStatus.FAILED) {
    if (
      !derivedIncomplete &&
      chatAttachmentParseAlreadyComplete(row, resolution.pipelineId)
    ) {
      return row;
    }
  }
  await enqueueParseJob(parseableFromChatAttachment(row), resolution.pipelineId);
  const running = await drizzleChatAttachmentRepository.getByIdOnly(row.id);
  return running ?? row;
}

export async function finalizeWorkspaceFileParse(
  row: WorkspaceFile,
  kind: AttachmentKind,
): Promise<WorkspaceFile> {
  const resolution = resolvePipeline(kind);
  if (resolution.action === "skip") {
    const updated = await drizzleWorkspaceRepository.markParseReady(row.id, {
      skipped: true,
    });
    return updated ?? row;
  }
  if (resolution.action === "reject") {
    throw new Error(`Unsupported file type for parse: ${row.mediaType}`);
  }
  const scopeId = parseableFromWorkspaceFile(row, row.userId).scopeId;
  const derivedIncomplete =
    resolution.pipelineId === "email_standard" &&
    (await emailDerivedMaterializationIncomplete(scopeId, row.id));
  if (
    resolution.pipelineId === "email_standard" &&
    row.parseStatus === ParseStatus.FAILED &&
    !derivedIncomplete &&
    parsedArtifactInManifest(row.parsedArtifactManifest, "content_md")
  ) {
    const updated = await drizzleWorkspaceRepository.markParseReady(row.id, {
      pipelineId: resolution.pipelineId,
    });
    return updated ?? row;
  }
  if (row.parseStatus !== ParseStatus.FAILED) {
    if (
      !derivedIncomplete &&
      workspaceFileParseAlreadyComplete(row, resolution.pipelineId)
    ) {
      return row;
    }
  }
  await enqueueParseJob(
    parseableFromWorkspaceFile(row, row.userId),
    resolution.pipelineId,
  );
  const running = await drizzleWorkspaceRepository.getFileByIdOnly(row.id);
  return running ?? row;
}

export async function enqueueParseJob(
  row: ParseableFile,
  pipelineId: string,
): Promise<void> {
  const jobId = newJobId();
  const webhookSecret = newWebhookSecret();
  const { payload, runToken } = buildJobPayload(row, {
    pipelineId,
    jobId,
    webhookSecret,
  });

  try {
    await createParseJobRun({
      jobId,
      attachmentId: row.id,
      sourceKind: row.sourceKind,
      scopeId: row.scopeId,
      chatId: row.chatId,
      runTokenHash: hashRunToken(runToken),
      webhookSecret,
      expiresAt: runExpiresAt(),
      jobPayloadJson: payload,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create parse job run";
    const fail = {
      status: ParseStatus.FAILED,
      errorCode: "PARSE_JOB_PERSIST_FAILED",
      errorMessage: message,
    };
    if (row.sourceKind === "workspace_file") {
      await drizzleWorkspaceRepository.applyParseWebhook(row.id, fail);
    } else {
      await drizzleChatAttachmentRepository.applyParseWebhook(row.id, fail);
    }
    return;
  }

  if (row.sourceKind === "workspace_file") {
    const updated = await drizzleWorkspaceRepository.markParsePending(row.id, {
      pipelineId,
      jobId,
    });
    if (!updated) throw new Error("Failed to mark workspace file parse pending");
  } else {
    const updated = await drizzleChatAttachmentRepository.markParsePending(row.id, {
      pipelineId,
      jobId,
    });
    if (!updated) throw new Error("Failed to mark attachment parse pending");
  }

  const mode = getParsePipelineDispatchMode();
  assertParseDispatchConfigured(mode);
  console.info("[parse] enqueue", {
    jobId,
    pipelineId,
    mode,
    attachmentId: row.id,
    sourceKind: row.sourceKind,
  });
  try {
    if (mode === "gha") {
      await dispatchParseGha({ jobId, runToken, pipelineId });
      console.info("[parse] gha dispatch ok", {
        jobId,
        repo: getGithubRepo(),
        workflow: getGithubWorkflowFile(),
      });
      scheduleGhaRunWatch(jobId);
    } else if (mode === "inline") {
      throw new Error("PARSE_PIPELINE_DISPATCH=inline is deprecated; use service");
    } else {
      await dispatchParseService(payload);
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Parse dispatch failed";
    console.error("[parse] dispatch failed", {
      jobId,
      mode,
      attachmentId: row.id,
      error: errorMessage,
    });
    const fail = {
      status: ParseStatus.FAILED,
      errorCode: "DISPATCH_FAILED",
      errorMessage,
    };
    if (row.sourceKind === "workspace_file") {
      await drizzleWorkspaceRepository.applyParseWebhook(row.id, fail);
    } else {
      await drizzleChatAttachmentRepository.applyParseWebhook(row.id, fail);
    }
    await import("../../infrastructure/persistence/parse/drizzle-parse-job.repository.js").then(
      ({ updateParseJobRunStatus }) => updateParseJobRunStatus(jobId, "failed"),
    );
    return;
  }

  const runningUpdate = {
    status: ParseStatus.RUNNING,
    stageSnapshot: {
      current_stage: "fetch",
      message:
        mode === "gha"
          ? "Dispatched to GitHub Actions — waiting for workflow…"
          : "Parse service accepted job — waiting for worker…",
      stages: [],
    },
  };
  if (row.sourceKind === "workspace_file") {
    await drizzleWorkspaceRepository.applyParseWebhook(row.id, runningUpdate);
  } else {
    await drizzleChatAttachmentRepository.applyParseWebhook(row.id, runningUpdate);
  }
}

export async function retryAttachmentParse(
  row: ChatAttachment,
): Promise<ChatAttachment> {
  const kind = classifyAttachment({
    filename: row.filename,
    mimeType: row.mediaType,
  });
  return finalizeAttachmentParse(row, kind);
}

export async function retryWorkspaceFileParse(
  row: WorkspaceFile,
): Promise<WorkspaceFile> {
  const kind = classifyAttachment({
    filename: row.filename,
    mimeType: row.mediaType,
  });
  return finalizeWorkspaceFileParse(row, kind);
}
