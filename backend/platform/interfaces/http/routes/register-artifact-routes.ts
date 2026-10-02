import { GET, type RouteDefinition } from "eve/channels";
import {
  contentDispositionAttachment,
  getArtifactDownloadForUser,
  getArtifactPreviewForUser,
  getArtifactSpecForUser,
  getDatabaseUrl,
  listAgentArtifactsForUser,
} from "../../../composition/public-api.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

export function registerArtifactRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { json, corsHeaders, preflight, requireUser } = ctx;

  return [
    preflight("/api/agents/:agentId/artifacts"),
    preflight("/api/chats/:id/artifacts/:artifactId/spec"),
    preflight("/api/chats/:id/artifacts/:artifactId"),
    preflight("/api/chats/:id/artifacts/:artifactId/preview"),
    preflight("/api/chats/:id/artifacts/:artifactId/preview/:filePath*"),

    GET("/api/agents/:agentId/artifacts", async (request, { params }) => {
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
      const sourceParam = url.searchParams.get("source");
      const source =
        sourceParam === "generic" ||
        sourceParam === "project" ||
        sourceParam === "schedule"
          ? sourceParam
          : undefined;
      try {
        const artifacts = await listAgentArtifactsForUser({
          userId: auth.principalId,
          agentId: params.agentId,
          source,
          projectId: url.searchParams.get("projectId")?.trim() || undefined,
          scheduleId: url.searchParams.get("scheduleId")?.trim() || undefined,
        });
        return json({ ok: true, artifacts }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to list artifacts",
          },
          500,
          request,
        );
      }
    }),

    GET("/api/chats/:id/artifacts/:artifactId/spec", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      const spec = await getArtifactSpecForUser({
        userId: auth.principalId,
        chatId: params.id,
        artifactId: params.artifactId,
      });
      if (!spec) {
        return json({ ok: false, error: "Artifact not found" }, 404, request);
      }
      return json({ ok: true, spec }, 200, request);
    }),

    GET("/api/chats/:id/artifacts/:artifactId", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      const variant = new URL(request.url).searchParams.get("format");
      const payload = await getArtifactDownloadForUser({
        userId: auth.principalId,
        chatId: params.id,
        artifactId: params.artifactId,
        variant,
      });
      if (!payload) {
        return json({ ok: false, error: "Artifact not found" }, 404, request);
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

    GET("/api/chats/:id/artifacts/:artifactId/preview", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      const preview = await getArtifactPreviewForUser({
        userId: auth.principalId,
        chatId: params.id,
        artifactId: params.artifactId,
        filePath: "index.html",
      });
      if (!preview) {
        return json({ ok: false, error: "Preview not found" }, 404, request);
      }
      return new Response(Buffer.from(preview.data), {
        status: 200,
        headers: {
          ...corsHeaders(request),
          "Content-Type": preview.mediaType,
          "Cache-Control": "private, no-store",
        },
      });
    }),

    GET("/api/chats/:id/artifacts/:artifactId/preview/:filePath*", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      const filePath = params.filePath ?? "index.html";
      const preview = await getArtifactPreviewForUser({
        userId: auth.principalId,
        chatId: params.id,
        artifactId: params.artifactId,
        filePath,
      });
      if (!preview) {
        return json({ ok: false, error: "Preview not found" }, 404, request);
      }
      return new Response(Buffer.from(preview.data), {
        status: 200,
        headers: {
          ...corsHeaders(request),
          "Content-Type": preview.mediaType,
          "Cache-Control": "private, no-store",
        },
      });
    }),
  ];
}
