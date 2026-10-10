import type { HandleUploadBody } from "@vercel/blob/client";
import { DELETE, GET, OPTIONS, PATCH, POST, type RouteDefinition } from "eve/channels";
import {
  createWorkspaceFolderForUser,
  deleteWorkspaceFileForUser,
  deleteWorkspaceFolderForUser,
  finalizeWorkspaceFileBlobUpload,
  getDatabaseUrl,
  getWorkspaceFileDownloadForUser,
  getWorkspaceFileFigureForUser,
  getWorkspaceFilePreviewBundleForUser,
  getWorkspaceFilePreviewForUser,
  listWorkspaceFilesForUser,
  listWorkspaceFilesByIdsForUser,
  listWorkspaceFoldersForUser,
  prepareWorkspaceFileBlobUpload,
  renameWorkspaceFolderForUser,
  uploadWorkspaceFileForUser,
  retryWorkspaceFileParseForUser,
} from "../../../composition/public-api.js";
import { ATTACHMENT_SERVER_MULTIPART_MAX_BYTES } from "../../../infrastructure/config/attachment-limits.config.js";
import { hasBlobStorageConfigured } from "../../../infrastructure/artifact/blob-client.js";
import { handleWorkspaceFileBlobUploadRequest } from "../workspace-file-blob-upload.handler.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

export function registerWorkspaceRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { json, corsHeaders, preflight, requireUser } = ctx;

  return [
    preflight("/api/workspace/batch-file-lookup"),
    preflight("/api/workspace-upload/prepare-blob-upload"),
    preflight("/api/workspace-upload/finalize-blob-upload"),
    preflight("/api/workspace-upload/blob-upload"),
    preflight("/api/workspace/folders"),
    preflight("/api/workspace/folders/:id"),
    preflight("/api/workspace/folders/:id/files"),
    preflight("/api/workspace/files/:id/preview"),
    preflight("/api/workspace/files/:id/preview-bundle"),
    preflight("/api/workspace/files/:id/download"),
    preflight("/api/workspace/files/:id/retry-parse"),
    preflight("/api/workspace/files/:id/figures/:figureId"),
    // DELETE on `/api/workspace/files/:id` — explicit OPTIONS only (no duplicate preflight).
    OPTIONS("/api/workspace/files/:id", async (request) =>
      new Response(null, { status: 204, headers: corsHeaders(request) }),
    ),

    POST("/api/workspace/batch-file-lookup", async (request) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      let body: { ids?: unknown };
      try {
        body = (await request.json()) as { ids?: unknown };
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      const raw = body.ids;
      const fileIds = Array.isArray(raw)
        ? raw.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [];
      const files = await listWorkspaceFilesByIdsForUser({
        userId: auth.principalId,
        fileIds,
      });
      return json({ ok: true, files }, 200, request);
    }),

    GET("/api/workspace/folders", async (request) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      if (!getDatabaseUrl()) {
        return json({ ok: false, error: "DATABASE_URL is not configured" }, 503, request);
      }
      const folders = await listWorkspaceFoldersForUser(auth.principalId);
      return json({ ok: true, folders }, 200, request);
    }),

    POST("/api/workspace/folders", async (request) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      let body: { name?: string };
      try {
        body = (await request.json()) as { name?: string };
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      const folder = await createWorkspaceFolderForUser({
        userId: auth.principalId,
        name: body.name ?? "",
      });
      if (!folder) {
        return json({ ok: false, error: "Name is required" }, 400, request);
      }
      return json({ ok: true, folder }, 200, request);
    }),

    PATCH("/api/workspace/folders/:id", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      let body: { name?: string };
      try {
        body = (await request.json()) as { name?: string };
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      const folder = await renameWorkspaceFolderForUser({
        userId: auth.principalId,
        folderId: params.id,
        name: body.name ?? "",
      });
      if (!folder) {
        return json({ ok: false, error: "Folder not found" }, 404, request);
      }
      return json({ ok: true, folder }, 200, request);
    }),

    DELETE("/api/workspace/folders/:id", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const result = await deleteWorkspaceFolderForUser({
        userId: auth.principalId,
        folderId: params.id,
      });
      if (!result.deleted) {
        return json({ ok: false, error: result.error ?? "Failed" }, 400, request);
      }
      return json({ ok: true }, 200, request);
    }),

    POST("/api/workspace-upload/prepare-blob-upload", async (request) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }
      let body: {
        folderId?: string;
        filename?: string;
        mediaType?: string;
        sizeBytes?: number;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      const folderId = String(body.folderId ?? "").trim();
      if (!folderId) {
        return json({ ok: false, error: "folderId is required" }, 400, request);
      }
      const result = await prepareWorkspaceFileBlobUpload({
        userId: auth.principalId,
        folderId,
        filename: String(body.filename ?? "").trim() || "upload",
        mediaType: String(body.mediaType ?? "").trim() || "application/octet-stream",
        sizeBytes: Number(body.sizeBytes ?? 0),
      });
      if ("error" in result) {
        return json({ ok: false, error: result.error }, 400, request);
      }
      return json({ ok: true, ...result }, 200, request);
    }),

    POST("/api/workspace-upload/finalize-blob-upload", async (request) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }
      let body: {
        folderId?: string;
        fileId?: string;
        filename?: string;
        mediaType?: string;
        sizeBytes?: number;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      const folderId = String(body.folderId ?? "").trim();
      const fileId = String(body.fileId ?? "").trim();
      if (!folderId || !fileId) {
        return json(
          { ok: false, error: "folderId and fileId are required" },
          400,
          request,
        );
      }
      const result = await finalizeWorkspaceFileBlobUpload({
        userId: auth.principalId,
        folderId,
        fileId,
        filename: String(body.filename ?? "").trim() || "upload",
        mediaType: String(body.mediaType ?? "").trim() || "application/octet-stream",
        sizeBytes: Number(body.sizeBytes ?? 0),
      });
      if (!result.file) {
        return json(
          { ok: false, error: result.error ?? "Finalize failed" },
          400,
          request,
        );
      }
      return json({ ok: true, file: result.file }, 201, request);
    }),

    POST("/api/workspace-upload/blob-upload", async (request) => {
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
          const result = await handleWorkspaceFileBlobUploadRequest({
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
        const result = await handleWorkspaceFileBlobUploadRequest({
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

    GET("/api/workspace/folders/:id/files", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const files = await listWorkspaceFilesForUser({
        userId: auth.principalId,
        folderId: params.id,
      });
      return json({ ok: true, files }, 200, request);
    }),

    POST("/api/workspace/folders/:id/files", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return json({ ok: false, error: "Invalid multipart body" }, 400, request);
      }
      const file = form.get("file");
      if (!(file instanceof File)) {
        return json({ ok: false, error: "file field required" }, 400, request);
      }
      if (
        hasBlobStorageConfigured() &&
        file.size > ATTACHMENT_SERVER_MULTIPART_MAX_BYTES
      ) {
        return json(
          {
            ok: false,
            error:
              "File is too large for API upload. Use direct blob upload (refresh the app if you still see this).",
          },
          413,
          request,
        );
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const result = await uploadWorkspaceFileForUser({
          userId: auth.principalId,
          folderId: params.id,
          filename: file.name || "upload",
          mediaType: file.type || "application/octet-stream",
          bytes,
        });
        if (!result.file) {
          return json({ ok: false, error: result.error ?? "Upload failed" }, 400, request);
        }
        return json({ ok: true, file: result.file }, 200, request);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Upload failed unexpectedly";
        return json({ ok: false, error: message }, 500, request);
      }
    }),

    POST("/api/workspace/files/:id/retry-parse", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "DATABASE_URL is not configured" },
          503,
          request,
        );
      }
      const result = await retryWorkspaceFileParseForUser({
        userId: auth.principalId,
        fileId: params.id,
      });
      if (!result.file) {
        return json(
          { ok: false, error: result.error ?? "Retry failed" },
          400,
          request,
        );
      }
      return json({ ok: true, file: result.file }, 200, request);
    }),

    DELETE("/api/workspace/files/:id", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      try {
        const deleted = await deleteWorkspaceFileForUser({
          userId: auth.principalId,
          fileId: params.id,
        });
        if (!deleted) {
          return json({ ok: false, error: "File not found" }, 404, request);
        }
        return json({ ok: true }, 200, request);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Delete failed unexpectedly";
        return json({ ok: false, error: message }, 500, request);
      }
    }),

    GET("/api/workspace/files/:id/figures/:figureId", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const payload = await getWorkspaceFileFigureForUser({
        userId: auth.principalId,
        fileId: params.id,
        figureRef: params.figureId,
      });
      if (!payload) {
        return json({ ok: false, error: "Figure not found" }, 404, request);
      }
      return new Response(Buffer.from(payload.data), {
        headers: {
          ...corsHeaders(request),
          "Content-Type": payload.mediaType,
          "Cache-Control": "private, no-store",
        },
      });
    }),

    GET("/api/workspace/files/:id/preview", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const preview = await getWorkspaceFilePreviewForUser({
        userId: auth.principalId,
        fileId: params.id,
      });
      if (!preview) {
        return json({ ok: false, error: "Preview not available" }, 404, request);
      }
      return json({ ok: true, ...preview }, 200, request);
    }),

    GET("/api/workspace/files/:id/preview-bundle", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const bundle = await getWorkspaceFilePreviewBundleForUser({
        userId: auth.principalId,
        fileId: params.id,
      });
      if (!bundle) {
        return json({ ok: false, error: "Preview not available" }, 404, request);
      }
      return json({ ok: true, bundle }, 200, request);
    }),

    GET("/api/workspace/files/:id/download", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) return json({ ok: false, error: "Unauthorized" }, 401, request);
      const payload = await getWorkspaceFileDownloadForUser({
        userId: auth.principalId,
        fileId: params.id,
      });
      if (!payload) {
        return json({ ok: false, error: "Not found" }, 404, request);
      }
      return new Response(Buffer.from(payload.data), {
        headers: {
          ...corsHeaders(request),
          "Content-Type": payload.mediaType,
          "Content-Disposition": `inline; filename="${payload.filename.replace(/"/g, "")}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }),
  ];
}
