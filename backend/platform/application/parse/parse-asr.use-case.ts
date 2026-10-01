import { createHmac, timingSafeEqual } from "node:crypto";
import { getAttachmentBytes } from "../../infrastructure/attachment/attachment-storage.js";
import {
  getAttachmentExternallyFetchableUrl,
  isLoopbackParsePublicBase,
} from "../../infrastructure/attachment/attachment-blob-fetch-url.js";
import { hasBlobStorageConfigured } from "../../infrastructure/artifact/blob-client.js";
import { getParsePipelinePublicBaseUrl } from "../../infrastructure/config/parse-pipeline.config.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import {
  getParseJobRunByJobId,
  getParseJobRunByToken,
} from "../../infrastructure/persistence/parse/drizzle-parse-job.repository.js";
import { hashRunToken } from "../../infrastructure/parse-pipeline/job-builder.js";

const ASR_URL_TTL_SEC = 2 * 60 * 60;

function capturePartIds(payload: Record<string, unknown>): Set<string> {
  const source = payload.source;
  if (!source || typeof source !== "object") return new Set();
  const capture = (source as { capture?: { parts?: unknown[] } }).capture;
  const parts = capture?.parts;
  if (!Array.isArray(parts)) return new Set();
  const ids = new Set<string>();
  for (const part of parts) {
    if (part && typeof part === "object") {
      const id = (part as { attachment_id?: string }).attachment_id;
      if (id) ids.add(id);
    }
  }
  return ids;
}

function signAsrUrl(input: {
  jobId: string;
  attachmentId: string;
  exp: number;
  secret: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(`${input.jobId}:${input.attachmentId}:${input.exp}`)
    .digest("hex");
}

/** Platform proxy URL (HTTPS deployment only — not reachable by cloud ASR when base is localhost). */
export function buildAsrFileDownloadUrl(input: {
  jobId: string;
  attachmentId: string;
  webhookSecret: string;
}): string {
  const publicBase = getParsePipelinePublicBaseUrl();
  if (!publicBase) {
    throw new Error("PARSE_PIPELINE_PUBLIC_BASE_URL is required");
  }
  const exp = Math.floor(Date.now() / 1000) + ASR_URL_TTL_SEC;
  const sig = signAsrUrl({
    jobId: input.jobId,
    attachmentId: input.attachmentId,
    exp,
    secret: input.webhookSecret,
  });
  const base = publicBase.replace(/\/+$/, "");
  return `${base}/internal/parse/v1/asr-files/${input.attachmentId}?job_id=${encodeURIComponent(input.jobId)}&exp=${exp}&sig=${sig}`;
}

async function resolveAsrMintUrl(input: {
  jobId: string;
  chatId: string;
  attachmentId: string;
  webhookSecret: string;
}): Promise<string> {
  const attachment = await drizzleChatAttachmentRepository.getById({
    chatId: input.chatId,
    attachmentId: input.attachmentId,
  });
  if (!attachment) {
    throw new Error(`Attachment ${input.attachmentId} not found for ASR mint.`);
  }

  const blobUrl = await getAttachmentExternallyFetchableUrl({
    chatId: input.chatId,
    storageKey: attachment.storageKey,
  });
  if (blobUrl) {
    return blobUrl;
  }

  const publicBase = getParsePipelinePublicBaseUrl();
  if (hasBlobStorageConfigured()) {
    throw new Error(
      "Audio file is not available in Vercel Blob yet. Retry after upload completes.",
    );
  }
  if (!publicBase || isLoopbackParsePublicBase(publicBase)) {
    throw new Error(
      "Audio transcription requires Vercel Blob (BLOB_READ_WRITE_TOKEN) in local dev so ASR can fetch files over HTTPS. Same storage path as production/GHA.",
    );
  }

  return buildAsrFileDownloadUrl({
    jobId: input.jobId,
    attachmentId: input.attachmentId,
    webhookSecret: input.webhookSecret,
  });
}

export async function mintAsrFileUrls(input: {
  jobId: string;
  bearerToken: string;
  attachmentIds: string[];
}): Promise<{ urls: Array<{ attachment_id: string; url: string }> } | null> {
  const run = await getParseJobRunByToken(input.jobId, hashRunToken(input.bearerToken));
  if (!run) return null;
  const payload = run.jobPayloadJson as Record<string, unknown>;
  const allowed = capturePartIds(payload);
  const urls: Array<{ attachment_id: string; url: string }> = [];
  for (const attachmentId of input.attachmentIds) {
    if (!allowed.has(attachmentId)) continue;
    urls.push({
      attachment_id: attachmentId,
      url: await resolveAsrMintUrl({
        jobId: input.jobId,
        chatId: run.chatId ?? run.scopeId,
        attachmentId,
        webhookSecret: run.webhookSecret,
      }),
    });
  }
  return { urls };
}

export async function readAsrFileForSignedUrl(input: {
  jobId: string;
  attachmentId: string;
  exp: number;
  sig: string;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (input.exp < Math.floor(Date.now() / 1000)) return null;
  const run = await getParseJobRunByJobId(input.jobId);
  if (!run) return null;
  const expected = signAsrUrl({
    jobId: input.jobId,
    attachmentId: input.attachmentId,
    exp: input.exp,
    secret: run.webhookSecret,
  });
  try {
    if (
      !timingSafeEqual(
        Buffer.from(expected, "utf8"),
        Buffer.from(input.sig, "utf8"),
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }
  const payload = run.jobPayloadJson as Record<string, unknown>;
  if (!capturePartIds(payload).has(input.attachmentId)) return null;

  const chatId = run.chatId ?? run.scopeId;
  const attachment = await drizzleChatAttachmentRepository.getById({
    chatId,
    attachmentId: input.attachmentId,
  });
  if (!attachment) return null;
  const bytes = await getAttachmentBytes(run.scopeId, attachment.storageKey);
  if (!bytes?.byteLength) return null;
  return { bytes, mediaType: attachment.mediaType };
}
