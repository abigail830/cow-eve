import { createHash } from "node:crypto";
import {
  classifyAttachment,
  type AttachmentKind,
} from "../../domain/attachment/attachment-kinds.js";
import type { ChatAttachment } from "../../domain/attachment/chat-attachment.entity.js";
import { ParseStatus } from "../../domain/parse/parse-status.js";
import { getParsePipelineDispatchMode } from "../../infrastructure/config/parse-pipeline.config.js";
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
import { createParseJobRun } from "../../infrastructure/persistence/parse/drizzle-parse-job.repository.js";

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
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
  if (
    row.parseStatus === ParseStatus.READY ||
    row.parseStatus === ParseStatus.SKIPPED
  ) {
    if (row.parsePipelineId === resolution.pipelineId) return row;
  }
  return enqueueParseJob(row, resolution.pipelineId);
}

export async function enqueueParseJob(
  row: ChatAttachment,
  pipelineId: string,
): Promise<ChatAttachment> {
  const jobId = newJobId();
  const webhookSecret = newWebhookSecret();
  const { payload, runToken } = buildJobPayload(row, {
    pipelineId,
    jobId,
    webhookSecret,
  });

  await createParseJobRun({
    jobId,
    attachmentId: row.id,
    chatId: row.chatId,
    runTokenHash: hashRunToken(runToken),
    webhookSecret,
    expiresAt: runExpiresAt(),
    jobPayloadJson: payload,
  });

  const updated = await drizzleChatAttachmentRepository.markParsePending(row.id, {
    pipelineId,
    jobId,
  });
  if (!updated) throw new Error("Failed to mark attachment parse pending");

  const mode = getParsePipelineDispatchMode();
  try {
    if (mode === "gha") {
      await dispatchParseGha({
        jobId,
        runToken,
        pipelineId,
      });
      scheduleGhaRunWatch(jobId);
    } else if (mode === "inline") {
      throw new Error("PARSE_PIPELINE_DISPATCH=inline is deprecated; use service");
    } else {
      await dispatchParseService(payload);
    }
  } catch (err) {
    await drizzleChatAttachmentRepository.applyParseWebhook(row.id, {
      status: ParseStatus.FAILED,
      errorCode: "DISPATCH_FAILED",
      errorMessage: err instanceof Error ? err.message : "Parse dispatch failed",
    });
    await import("../../infrastructure/persistence/parse/drizzle-parse-job.repository.js").then(
      ({ updateParseJobRunStatus }) => updateParseJobRunStatus(jobId, "failed"),
    );
    throw err;
  }

  await drizzleChatAttachmentRepository.applyParseWebhook(row.id, {
    status: ParseStatus.RUNNING,
    stageSnapshot: {
      current_stage: "fetch",
      message: "Parse service accepted job — waiting for worker…",
      stages: [],
    },
  });

  const running = await drizzleChatAttachmentRepository.getByIdOnly(row.id);
  return running ?? updated;
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
