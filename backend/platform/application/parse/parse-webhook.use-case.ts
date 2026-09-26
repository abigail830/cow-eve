import { createHmac, timingSafeEqual } from "node:crypto";
import { parsedArtifactInManifest } from "../../domain/docstore/parsed-manifest.js";
import { ParseStatus } from "../../domain/parse/parse-status.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import {
  getParseJobRunByJobId,
  getParseJobRunByToken,
  updateParseJobRunStatus,
} from "../../infrastructure/persistence/parse/drizzle-parse-job.repository.js";

const WEBHOOK_MAX_SKEW_SEC = 300;

export function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string;
  body: Uint8Array;
  signatureHeader: string | null;
}): boolean {
  if (!input.signatureHeader?.startsWith("v1=")) return false;
  const ts = Number.parseInt(input.timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > WEBHOOK_MAX_SKEW_SEC) {
    return false;
  }
  const expected = createHmac("sha256", input.secret)
    .update(`${input.timestamp}.`)
    .update(input.body)
    .digest("hex");
  const provided = input.signatureHeader.slice(3);
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(provided, "utf8"),
    );
  } catch {
    return false;
  }
}

function mapParseStatus(payload: Record<string, unknown>): string {
  const event = String(payload.event ?? "");
  const status = String(payload.status ?? "").toLowerCase();
  const artifacts = payload.artifacts;
  if (event === "job.failed" || status === "failed") return ParseStatus.FAILED;
  if (event === "job.completed" || status === "succeeded") {
    if (
      artifacts &&
      typeof artifacts === "object" &&
      (artifacts as { ready?: boolean }).ready
    ) {
      return ParseStatus.READY;
    }
    return ParseStatus.RUNNING;
  }
  if (status === "running" || status === "queued") return ParseStatus.RUNNING;
  return ParseStatus.RUNNING;
}

function stageSnapshotFromPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const progress = payload.progress;
  const stages = payload.stages;
  const simplified = Array.isArray(stages)
    ? stages
        .filter((s): s is Record<string, unknown> => typeof s === "object" && !!s)
        .map((s) => ({
          stage_id: s.stage_id,
          status: s.status,
          started_at: s.started_at,
          finished_at: s.finished_at,
        }))
    : [];
  return {
    current_stage: payload.current_stage,
    message:
      progress && typeof progress === "object"
        ? (progress as { message?: string }).message
        : null,
    stages: simplified,
  };
}

export async function applyParseWebhook(input: {
  jobId: string;
  webhookSecret: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const attachmentId = String(
    input.payload.attachment_id ??
      (input.payload.source as { source_id?: string })?.source_id ??
      "",
  );
  if (!attachmentId) {
    const run = await getParseJobRunByJobId(input.jobId);
    if (!run) return;
    const parseStatus = mapParseStatus(input.payload);
    await drizzleChatAttachmentRepository.applyParseWebhook(run.attachmentId, {
      status: parseStatus,
      stageSnapshot: stageSnapshotFromPayload(input.payload),
    });
    await updateParseJobRunStatus(input.jobId, parseStatus);
    if (parseStatus === ParseStatus.READY) {
      const { scheduleAttachmentGist } = await import(
        "../attachment/gist-scheduler.js"
      );
      scheduleAttachmentGist(run.attachmentId);
    }
    return;
  }

  const parseStatus = mapParseStatus(input.payload);
  const stageSnapshot = stageSnapshotFromPayload(input.payload);
  const error =
    input.payload.error && typeof input.payload.error === "object"
      ? (input.payload.error as { code?: string; message?: string })
      : null;

  await drizzleChatAttachmentRepository.applyParseWebhook(attachmentId, {
    status: parseStatus,
    stageSnapshot,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
  });

  if (parseStatus === ParseStatus.READY) {
    const row = await drizzleChatAttachmentRepository.getByIdOnly(attachmentId);
    if (
      row &&
      !parsedArtifactInManifest(row.parsedArtifactManifest, "content_md")
    ) {
      // Worker should have written artifacts via batch API before job.completed.
    }
  }

  await updateParseJobRunStatus(input.jobId, parseStatus);

  if (parseStatus === ParseStatus.READY) {
    const { scheduleAttachmentGist } = await import(
      "../attachment/gist-scheduler.js"
    );
    const id =
      attachmentId ||
      (await getParseJobRunByJobId(input.jobId))?.attachmentId ||
      "";
    if (id) scheduleAttachmentGist(id);
  }
}

export async function getParseJobPayloadForRun(
  jobId: string,
  bearerToken: string,
): Promise<Record<string, unknown> | null> {
  const { hashRunToken } = await import(
    "../../infrastructure/parse-pipeline/job-builder.js"
  );
  const run = await getParseJobRunByToken(jobId, hashRunToken(bearerToken));
  return run?.jobPayloadJson ?? null;
}
