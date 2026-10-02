import { DELETE, GET, POST, PUT, type RouteDefinition } from "eve/channels";
import {
  deleteChatForUser,
  getChatForUser,
  getDatabaseUrl,
  listChats,
  registerChatWorkspaceFileRefsForUser,
  renameChatTitleForUser,
} from "../../../composition/public-api.js";
import type { PlatformRouteContext } from "../platform-route-context.js";
import { toChatSummary } from "../helpers/chat-summary.dto.js";

export function registerChatRoutes(ctx: PlatformRouteContext): RouteDefinition[] {
  const { json, preflight, requireUser } = ctx;

  return [
    preflight("/api/chats"),
    preflight("/api/chats/:id"),
    preflight("/api/chats/:id/workspace-file-refs"),

    GET("/api/chats", async (request) => {
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
      const agentId = url.searchParams.get("agentId")?.trim();
      if (!agentId) {
        return json(
          { ok: false, error: "agentId query parameter is required" },
          400,
          request,
        );
      }
      const scopeParam = url.searchParams.get("scope");
      const scope =
        scopeParam === "generic" ||
        scopeParam === "project" ||
        scopeParam === "schedule"
          ? scopeParam
          : undefined;
      const projectId = url.searchParams.get("projectId")?.trim() || undefined;
      const scheduleId = url.searchParams.get("scheduleId")?.trim() || undefined;
      try {
        const rows = await listChats({
          userId: auth.principalId,
          agentId,
          scope,
          projectId,
          scheduleId,
        });
        return json(
          { ok: true, chats: rows.map(toChatSummary) },
          200,
          request,
        );
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to list chats",
          },
          500,
          request,
        );
      }
    }),

    GET("/api/chats/:id", async (request, { params }) => {
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
      const chatId = params.id;
      try {
        const chat = await getChatForUser({
          userId: auth.principalId,
          chatId,
        });
        if (!chat) {
          return json({ ok: false, error: "Chat not found" }, 404, request);
        }
        return json(
          {
            ok: true,
            chat: {
              ...toChatSummary(chat),
              streamIndex: chat.eveStreamIndex,
              events: chat.events.map((event) => event.payload),
            },
          },
          200,
          request,
        );
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to load chat",
          },
          500,
          request,
        );
      }
    }),

    DELETE("/api/chats/:id", async (request, { params }) => {
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
      const chatId = params.id;
      try {
        const deleted = await deleteChatForUser({
          userId: auth.principalId,
          chatId,
        });
        if (!deleted) {
          return json({ ok: false, error: "Chat not found" }, 404, request);
        }
        return json({ ok: true }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to delete chat",
          },
          500,
          request,
        );
      }
    }),

    POST("/api/chats/:id/workspace-file-refs", async (request, { params }) => {
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
      let body: { fileIds?: unknown };
      try {
        body = (await request.json()) as { fileIds?: unknown };
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      const raw = body.fileIds;
      if (!Array.isArray(raw)) {
        return json({ ok: false, error: "fileIds array is required" }, 400, request);
      }
      const workspaceFileIds = raw
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);
      try {
        await registerChatWorkspaceFileRefsForUser({
          userId: auth.principalId,
          chatId: params.id,
          workspaceFileIds,
        });
        return json({ ok: true, count: workspaceFileIds.length }, 200, request);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to register refs";
        const status = message === "Chat not found." ? 404 : 500;
        return json({ ok: false, error: message }, status, request);
      }
    }),

    PUT("/api/chats/:id", async (request, { params }) => {
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
      let body: { title?: string };
      try {
        body = (await request.json()) as { title?: string };
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      const title = body.title?.trim() ?? "";
      if (!title) {
        return json({ ok: false, error: "Title is required" }, 400, request);
      }
      try {
        const updated = await renameChatTitleForUser({
          userId: auth.principalId,
          chatId: params.id,
          title,
        });
        if (!updated) {
          return json({ ok: false, error: "Chat not found" }, 404, request);
        }
        return json({ ok: true, title }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to update chat",
          },
          500,
          request,
        );
      }
    }),
  ];
}
