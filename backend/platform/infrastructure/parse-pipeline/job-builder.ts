import { createHash, randomBytes } from "node:crypto";
import type { ChatAttachment } from "../../domain/attachment/chat-attachment.entity.js";
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
  row: ChatAttachment,
  input: {
    pipelineId: string;
    jobId: string;
    webhookSecret: string;
  },
): { payload: Record<string, unknown>; runToken: string } {
  const publicBase = getParsePipelinePublicBaseUrl();
  if (!publicBase) {
    throw new Error("PARSE_PIPELINE_PUBLIC_BASE_URL is required for parse dispatch");
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
    ? `sha256:${row.chatId}:${row.id}:${row.contentHash}`
    : null;

  const payload: Record<string, unknown> = {
    schema_version: "1.0",
    job_id: input.jobId,
    idempotency_key: idempotencyKey,
    pipeline_id: input.pipelineId,
    storage,
    source: {
      source_type: "chat_attachment",
      source_id: row.id,
      tenant_id: row.chatId,
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
