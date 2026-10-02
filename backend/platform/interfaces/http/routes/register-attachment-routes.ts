import { DELETE, GET, POST, type RouteDefinition } from "eve/channels";
import type { HandleUploadBody } from "@vercel/blob/client";
import {
  addAudioCapturePartFile,
  addAudioCapturePartFromAttachment,
  createAudioCaptureDraft,
  getAudioCaptureTranscriptMarkdown,
  listAudioCapturesForUser,
  retryAudioCaptureTranscription,
  startAudioCaptureTranscription,
} from "../../../application/attachment/audio-capture.use-case.js";
import {
  contentDispositionAttachment,
  deleteChatAttachmentForUser,
  finalizeChatAttachmentBlobUpload,
  getAttachmentUploadPolicy,
  getChatAttachmentDownloadForUser,
  getDatabaseUrl,
  listChatAttachmentsForUser,
  listChatAttachmentsForUserBySession,
  prepareChatAttachmentBlobUpload,
  retryChatAttachmentParseForUser,
  uploadChatAttachmentForUser,
} from "../../../composition/public-api.js";
import { handleChatAttachmentBlobUploadRequest } from "../chat-attachment-blob-upload.handler.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

export function registerAttachmentRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { json, corsHeaders, preflight, requireUser } = ctx;

  return [
    preflight("/api/chat-attachments"),
    preflight("/api/chat-attachments/upload-policy"),
    preflight("/api/chat-attachments/prepare-blob-upload"),
    preflight("/api/chat-attachments/finalize-blob-upload"),
    preflight("/api/chat-attachments/blob-upload"),
    preflight("/api/chats/:id/attachments"),
    preflight("/api/chats/:id/attachments/:attachmentId"),
    preflight("/api/audio-captures"),
    preflight("/api/chats/:id/audio-captures"),
    preflight("/api/chats/:id/audio-captures/:captureId"),
    preflight("/api/chats/:id/audio-captures/:captureId/parts"),
    preflight("/api/chats/:id/audio-captures/:captureId/start"),
    preflight("/api/chats/:id/audio-captures/:captureId/retry"),
    preflight("/api/chats/:id/audio-captures/:captureId/transcript"),

    GET("/api/chat-attachments", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }

      const url = new URL(request.url);
      const chatId = url.searchParams.get("chatId")?.trim() || undefined;
      const eveSessionId =
        url.searchParams.get("eveSessionId")?.trim() || undefined;
      if (!chatId && !eveSessionId) {
        return json(
          { ok: false, error: "chatId or eveSessionId is required" },
          400,
          request,
        );
      }

      const attachments = chatId
        ? await listChatAttachmentsForUser({
            userId: auth.principalId,
            chatId,
          })
        : await listChatAttachmentsForUserBySession({
            userId: auth.principalId,
            eveSessionId: eveSessionId!,
          });

      return json({ ok: true, attachments }, 200, request);
    }),

    GET("/api/chat-attachments/upload-policy", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      return json({ ok: true, policy: getAttachmentUploadPolicy() }, 200, request);
    }),

    POST("/api/chat-attachments/prepare-blob-upload", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }

      let body: {
        chatId?: string;
        eveSessionId?: string;
        agentId?: string;
        filename?: string;
        mediaType?: string;
        sizeBytes?: number;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      const result = await prepareChatAttachmentBlobUpload({
        userId: auth.principalId,
        agentId: String(body.agentId ?? "").trim() || "omni",
        chatId: body.chatId?.trim() || undefined,
        eveSessionId: body.eveSessionId?.trim() || undefined,
        filename: String(body.filename ?? "").trim() || "attachment",
        mediaType: String(body.mediaType ?? "").trim() || "application/octet-stream",
        sizeBytes: Number(body.sizeBytes ?? 0),
      });

      if ("error" in result) {
        return json({ ok: false, error: result.error }, 400, request);
      }

      return json({ ok: true, ...result }, 200, request);
    }),

    POST("/api/chat-attachments/finalize-blob-upload", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }

      let body: {
        attachmentId?: string;
        chatId?: string;
        agentId?: string;
        filename?: string;
        mediaType?: string;
        sizeBytes?: number;
        enqueueParse?: boolean;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      const attachmentId = String(body.attachmentId ?? "").trim();
      const chatId = String(body.chatId ?? "").trim();
      if (!attachmentId || !chatId) {
        return json(
          { ok: false, error: "attachmentId and chatId are required" },
          400,
          request,
        );
      }

      const result = await finalizeChatAttachmentBlobUpload({
        userId: auth.principalId,
        agentId: String(body.agentId ?? "").trim() || "omni",
        attachmentId,
        chatId,
        filename: String(body.filename ?? "").trim() || "attachment",
        mediaType: String(body.mediaType ?? "").trim() || "application/octet-stream",
        sizeBytes: Number(body.sizeBytes ?? 0),
        enqueueParse: body.enqueueParse === false ? false : undefined,
      });

      if (!result.attachment) {
        return json(
          { ok: false, error: result.error ?? "Finalize failed" },
          400,
          request,
        );
      }

      return json(
        {
          ok: true,
          attachment: result.attachment,
          ...(result.error ? { warning: result.error } : {}),
        },
        201,
        request,
      );
    }),

    POST("/api/chat-attachments/blob-upload", async (request) => {
      let body: HandleUploadBody;
      try {
        body = (await request.json()) as HandleUploadBody;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      if (body.type === "blob.generate-client-token") {
        const auth = await requireUser(request);
        if (!auth) {
          return json({ ok: false, error: "Unauthorized" }, 401, request);
        }
        try {
          const result = await handleChatAttachmentBlobUploadRequest({
            request,
            body,
            userId: auth.principalId,
          });
          return json(result, 200, request);
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : "Blob upload token failed",
            },
            400,
            request,
          );
        }
      }

      try {
        const result = await handleChatAttachmentBlobUploadRequest({
          request,
          body,
          userId: "",
        });
        return json(result, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Blob upload callback failed",
          },
          400,
          request,
        );
      }
    }),

    POST("/api/chat-attachments", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return json({ ok: false, error: "Invalid multipart body" }, 400, request);
      }

      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return json({ ok: false, error: "file is required" }, 400, request);
      }

      const chatId = String(form.get("chatId") ?? "").trim() || undefined;
      const eveSessionId =
        String(form.get("eveSessionId") ?? "").trim() || undefined;
      const agentId = String(form.get("agentId") ?? "").trim() || "omni";
      if (!chatId && !eveSessionId) {
        return json(
          { ok: false, error: "chatId or eveSessionId is required" },
          400,
          request,
        );
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const enqueueParseField = String(form.get("enqueueParse") ?? "").trim();
      const enqueueParse =
        enqueueParseField === "false" || enqueueParseField === "0"
          ? false
          : undefined;
      const result = await uploadChatAttachmentForUser({
        userId: auth.principalId,
        agentId,
        chatId,
        eveSessionId,
        filename: file.name || "attachment",
        mediaType: file.type || "application/octet-stream",
        bytes,
        enqueueParse,
      });

      if (!result.attachment) {
        return json(
          { ok: false, error: result.error ?? "Upload failed" },
          400,
          request,
        );
      }

      return json(
        {
          ok: true,
          attachment: result.attachment,
          ...(result.error ? { warning: result.error } : {}),
        },
        201,
        request,
      );
    }),

    GET("/api/chats/:id/attachments", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }

      const attachments = await listChatAttachmentsForUser({
        userId: auth.principalId,
        chatId: params.id,
      });
      return json({ ok: true, attachments }, 200, request);
    }),

    GET("/api/chats/:id/attachments/:attachmentId", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      const payload = await getChatAttachmentDownloadForUser({
        userId: auth.principalId,
        chatId: params.id,
        attachmentId: params.attachmentId,
      });
      if (!payload) {
        return json({ ok: false, error: "Attachment not found" }, 404, request);
      }
      return new Response(Buffer.from(payload.data), {
        status: 200,
        headers: {
          ...corsHeaders(request),
          "Content-Type": payload.mediaType,
          "Content-Disposition": contentDispositionAttachment(payload.filename),
          "Content-Length": String(payload.data.byteLength),
          "Cache-Control": "private, no-store",
        },
      });
    }),

    DELETE("/api/chats/:id/attachments/:attachmentId", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }

      const deleted = await deleteChatAttachmentForUser({
        userId: auth.principalId,
        chatId: params.id,
        attachmentId: params.attachmentId,
      });
      if (!deleted) {
        return json({ ok: false, error: "Attachment not found" }, 404, request);
      }
      return json({ ok: true }, 200, request);
    }),

    POST("/api/chats/:chatId/attachments/:attachmentId/retry-parse", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }
      const result = await retryChatAttachmentParseForUser({
        userId: auth.principalId,
        chatId: params.chatId,
        attachmentId: params.attachmentId,
      });
      if (!result.attachment) {
        return json(
          { ok: false, error: result.error ?? "Retry failed" },
          400,
          request,
        );
      }
      return json({ ok: true, attachment: result.attachment }, 200, request);
    }),

    GET("/api/audio-captures", async (request) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const url = new URL(request.url);
      const chatId = url.searchParams.get("chatId")?.trim() || undefined;
      const eveSessionId = url.searchParams.get("eveSessionId")?.trim() || undefined;
      const agentId = url.searchParams.get("agentId")?.trim() || undefined;
      if (!chatId && !eveSessionId) {
        return json(
          { ok: false, error: "chatId or eveSessionId is required" },
          400,
          request,
        );
      }
      const captures = await listAudioCapturesForUser({
        userId: auth.principalId,
        chatId,
        eveSessionId,
        agentId,
      });
      return json({ ok: true, captures }, 200, request);
    }),

    POST("/api/audio-captures", async (request) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      let body: {
        title?: string;
        chatId?: string;
        eveSessionId?: string;
        agentId?: string;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON" }, 400, request);
      }
      const result = await createAudioCaptureDraft({
        userId: auth.principalId,
        chatId: body.chatId?.trim() || undefined,
        eveSessionId: body.eveSessionId?.trim() || undefined,
        agentId: body.agentId?.trim() || undefined,
        title: body.title?.trim() ?? "Audio transcript",
      });
      if (!result.capture) {
        return json({ ok: false, error: result.error ?? "Failed" }, 400, request);
      }
      return json({ ok: true, capture: result.capture }, 201, request);
    }),

    GET("/api/chats/:id/audio-captures", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const captures = await listAudioCapturesForUser({
        userId: auth.principalId,
        chatId: params.id,
      });
      return json({ ok: true, captures }, 200, request);
    }),

    POST("/api/chats/:id/audio-captures", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      let body: { title?: string };
      try {
        body = (await request.json()) as { title?: string };
      } catch {
        return json({ ok: false, error: "Invalid JSON" }, 400, request);
      }
      const result = await createAudioCaptureDraft({
        userId: auth.principalId,
        chatId: params.id,
        title: body.title?.trim() ?? "Audio transcript",
      });
      if (!result.capture) {
        return json({ ok: false, error: result.error ?? "Failed" }, 400, request);
      }
      return json({ ok: true, capture: result.capture }, 201, request);
    }),

    POST("/api/chats/:id/audio-captures/:captureId/parts", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        let body: { attachmentId?: string };
        try {
          body = (await request.json()) as { attachmentId?: string };
        } catch {
          return json({ ok: false, error: "Invalid JSON" }, 400, request);
        }
        const attachmentId = String(body.attachmentId ?? "").trim();
        if (!attachmentId) {
          return json({ ok: false, error: "attachmentId is required" }, 400, request);
        }
        const result = await addAudioCapturePartFromAttachment({
          userId: auth.principalId,
          chatId: params.id,
          captureId: params.captureId,
          attachmentId,
        });
        if (!result.capture) {
          return json({ ok: false, error: result.error ?? "Link failed" }, 400, request);
        }
        return json({ ok: true, capture: result.capture }, 200, request);
      }

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return json({ ok: false, error: "Expected multipart form" }, 400, request);
      }
      const file = form.get("file");
      if (!(file instanceof File)) {
        return json({ ok: false, error: "Missing file field" }, 400, request);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await addAudioCapturePartFile({
        userId: auth.principalId,
        chatId: params.id,
        captureId: params.captureId,
        filename: file.name || "audio",
        mediaType: file.type || "application/octet-stream",
        bytes,
      });
      if (!result.capture) {
        return json({ ok: false, error: result.error ?? "Upload failed" }, 400, request);
      }
      return json({ ok: true, capture: result.capture }, 200, request);
    }),

    POST("/api/chats/:id/audio-captures/:captureId/start", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const result = await startAudioCaptureTranscription({
        userId: auth.principalId,
        chatId: params.id,
        captureId: params.captureId,
      });
      if (!result.capture) {
        return json({ ok: false, error: result.error ?? "Failed" }, 400, request);
      }
      return json({ ok: true, capture: result.capture }, 200, request);
    }),

    POST("/api/chats/:id/audio-captures/:captureId/retry", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const result = await retryAudioCaptureTranscription({
        userId: auth.principalId,
        chatId: params.id,
        captureId: params.captureId,
      });
      if (!result.capture) {
        return json({ ok: false, error: result.error ?? "Failed" }, 400, request);
      }
      return json({ ok: true, capture: result.capture }, 200, request);
    }),

    GET("/api/chats/:id/audio-captures/:captureId/transcript", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const result = await getAudioCaptureTranscriptMarkdown({
        userId: auth.principalId,
        chatId: params.id,
        captureId: params.captureId,
      });
      if (!result.markdown) {
        return json({ ok: false, error: result.error ?? "Not found" }, 404, request);
      }
      return new Response(result.markdown, {
        status: 200,
        headers: {
          ...Object.fromEntries(Object.entries(corsHeaders(request))),
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": contentDispositionAttachment(
            result.filename ?? "transcript.md",
          ),
          "Cache-Control": "private, no-store",
        },
      });
    }),
  ];
}
