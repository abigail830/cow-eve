import { createHash, randomBytes } from "node:crypto";
import type { ChatAttachment } from "../../domain/attachment/chat-attachment.entity.js";
import type { ParseableFile } from "../../domain/document/parseable-file.js";
import {
  getParsePipelinePublicBaseUrl,
  getParsePipelineWebhookPath,
} from "../config/parse-pipeline.config.js";
import { buildInternalStorageSpec } from "./storage-spec.js";

export function newJobId(): string {
  return `job_${randomBytes(13).toString("hex")}`;
}

export function newRunToken(): string {
  return `run_${randomBytes(24).toString("base64url")}`;
}

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(18).toString("base64url")}`;
}

export function hashRunToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function runExpiresAt(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

export function buildJobPayload(
  row: ParseableFile,
  input: {
    pipelineId: string;
    jobId: string;
    webhookSecret: string;
  },
): { payload: Record<string, unknown>; runToken: string } {
  const publicBase = getParsePipelinePublicBaseUrl();
  if (!publicBase) {
    throw new Error(
      "PARSE_PIPELINE_PUBLIC_BASE_URL is required for parse dispatch (Omni/backend public origin, not the frontend SPA)",
    );
  }
  const runToken = newRunToken();
  const storage = buildInternalStorageSpec({
    publicBaseUrl: publicBase,
    attachmentId: row.id,
    filename: row.filename,
    mimeType: row.mediaType,
    sizeBytes: row.sizeBytes,
    contentHash: row.contentHash ?? null,
    runToken,
  });
  const webhookUrl = `${publicBase.replace(/\/+$/, "")}${getParsePipelineWebhookPath()}`;
  const idempotencyKey = row.contentHash
    ? `sha256:${row.scopeId}:${row.id}:${row.contentHash}`
    : null;

  const payload: Record<string, unknown> = {
    schema_version: "1.0",
    job_id: input.jobId,
    idempotency_key: idempotencyKey,
    pipeline_id: input.pipelineId,
    storage,
    source: {
      source_type: row.sourceKind,
      source_id: row.id,
      tenant_id: row.scopeId,
      filename: row.filename,
      mime_type: row.mediaType,
      size_bytes: row.sizeBytes,
      content_hash: row.contentHash ?? null,
    },
    options: {
      office: { markitdown_enabled: true },
      document_mind: {
        llm_enhancement: true,
        enhancement_mode: "VLM",
        output_formats: ["markdown", "visualLayoutInfo"],
      },
    },
    callbacks: {
      webhook_url: webhookUrl,
      webhook_secret: input.webhookSecret,
    },
  };
  return { payload, runToken };
}

export type AudioCapturePartRef = {
  attachmentId: string;
  filename: string;
  sortOrder: number;
};

export function buildAudioCaptureJobPayload(
  outputRow: ChatAttachment,
  parts: readonly AudioCapturePartRef[],
  input: {
    jobId: string;
    webhookSecret: string;
    captureId: string;
    title: string;
  },
): { payload: Record<string, unknown>; runToken: string } {
  const publicBase = getParsePipelinePublicBaseUrl();
  if (!publicBase) {
    throw new Error(
      "PARSE_PIPELINE_PUBLIC_BASE_URL is required for parse dispatch (Omni/backend public origin, not the frontend SPA)",
    );
  }
  const runToken = newRunToken();
  const storage = buildInternalStorageSpec({
    publicBaseUrl: publicBase,
    attachmentId: outputRow.id,
    filename: outputRow.filename,
    mimeType: outputRow.mediaType,
    sizeBytes: outputRow.sizeBytes,
    contentHash: outputRow.contentHash ?? null,
    runToken,
  });
  const webhookUrl = `${publicBase.replace(/\/+$/, "")}${getParsePipelineWebhookPath()}`;

  const payload: Record<string, unknown> = {
    schema_version: "1.0",
    job_id: input.jobId,
    // Include jobId so retries enqueue a fresh worker run (parse service dedupes by idempotency_key).
    idempotency_key: `audio_capture:${input.captureId}:${outputRow.id}:${input.jobId}`,
    pipeline_id: "audio_transcription_standard",
    storage,
    source: {
      source_type: "audio_capture",
      source_id: input.captureId,
      tenant_id: outputRow.chatId,
      filename: outputRow.filename,
      mime_type: outputRow.mediaType,
      size_bytes: outputRow.sizeBytes,
      content_hash: outputRow.contentHash ?? null,
      capture: {
        capture_id: input.captureId,
        title: input.title,
        parts: parts.map((part) => ({
          attachment_id: part.attachmentId,
          filename: part.filename,
          sort_order: part.sortOrder,
        })),
      },
    },
    options: {
      asr: {
        diarization_enabled: true,
      },
    },
    callbacks: {
      webhook_url: webhookUrl,
      webhook_secret: input.webhookSecret,
    },
  };
  return { payload, runToken };
}
