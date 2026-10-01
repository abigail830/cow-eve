import type { ChatAttachment } from "../../domain/attachment/chat-attachment.entity.js";
import { ParseStatus } from "../../domain/parse/parse-status.js";
import { getParsePipelineDispatchMode } from "../../infrastructure/config/parse-pipeline.config.js";
import { dispatchParseGha } from "../../infrastructure/parse-pipeline/dispatch-gha.js";
import { dispatchParseService } from "../../infrastructure/parse-pipeline/dispatch-service.js";
import { scheduleGhaRunWatch } from "../../infrastructure/parse-pipeline/gha-watch.js";
import {
  buildAudioCaptureJobPayload,
  hashRunToken,
  newJobId,
  newWebhookSecret,
  runExpiresAt,
} from "../../infrastructure/parse-pipeline/job-builder.js";
import type { AudioCaptureWithParts } from "../../infrastructure/persistence/audio/drizzle-audio-capture.repository.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import { createParseJobRun } from "../../infrastructure/persistence/parse/drizzle-parse-job.repository.js";

export async function enqueueAudioCaptureParseJob(input: {
  capture: AudioCaptureWithParts;
  outputRow: ChatAttachment;
}): Promise<ChatAttachment> {
  const jobId = newJobId();
  const webhookSecret = newWebhookSecret();
  const { payload, runToken } = buildAudioCaptureJobPayload(
    input.outputRow,
    input.capture.parts.map((part) => ({
      attachmentId: part.attachmentId,
      filename: part.filename,
      sortOrder: part.sortOrder,
    })),
    {
      jobId,
      webhookSecret,
      captureId: input.capture.id,
      title: input.capture.title,
    },
  );

  await createParseJobRun({
    jobId,
    attachmentId: input.outputRow.id,
    sourceKind: "chat_attachment",
    scopeId: input.outputRow.chatId,
    chatId: input.outputRow.chatId,
    runTokenHash: hashRunToken(runToken),
    webhookSecret,
    expiresAt: runExpiresAt(),
    jobPayloadJson: payload,
  });

  const updated = await drizzleChatAttachmentRepository.markParsePending(
    input.outputRow.id,
    {
      pipelineId: "audio_transcription_standard",
      jobId,
    },
  );
  if (!updated) throw new Error("Failed to mark capture output parse pending");

  const mode = getParsePipelineDispatchMode();
  try {
    if (mode === "gha") {
      await dispatchParseGha({
        jobId,
        runToken,
        pipelineId: "audio_transcription_standard",
      });
      scheduleGhaRunWatch(jobId);
    } else if (mode === "inline") {
      throw new Error("PARSE_PIPELINE_DISPATCH=inline is deprecated; use service");
    } else {
      await dispatchParseService(payload);
    }
  } catch (err) {
    await drizzleChatAttachmentRepository.applyParseWebhook(input.outputRow.id, {
      status: ParseStatus.FAILED,
      errorCode: "DISPATCH_FAILED",
      errorMessage: err instanceof Error ? err.message : "Parse dispatch failed",
    });
    throw err;
  }

  const running = await drizzleChatAttachmentRepository.getByIdOnly(
    input.outputRow.id,
  );
  return running ?? updated;
}
