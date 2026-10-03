import { DELETE, GET, POST, PUT, type RouteDefinition } from "eve/channels";
import {
  bindChatSessionForUser,
  createProjectForUser,
  getDatabaseUrl,
  listProjectSummaryForUserAgent,
  listProjectWorkspaceFileRefsForUser,
  listProjectsForUserAgent,
  replaceProjectWorkspaceFileRefsForUser,
  updateProjectForUserAgent,
  deleteProjectForUserAgent,
  getProjectForUserAgent,
} from "../../../composition/public-api.js";
import type { PlatformRouteContext } from "../platform-route-context.js";
import {
  readAgentIdFromQuery,
  resolveRegisteredAgentId,
} from "../helpers/agent-scope.js";

export function registerProjectRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { json, preflight, requireUser } = ctx;

  return [
    preflight("/api/projects"),
    preflight("/api/projects/summary"),
    preflight("/api/chat-sessions/bind"),
    preflight("/api/projects/detail/:id"),
    preflight("/api/project-workspace-file-refs/:projectId"),

    GET("/api/projects/summary", async (request) => {
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
      const limit = Math.min(
        10,
        Math.max(1, Number(url.searchParams.get("limit") ?? "3") || 3),
      );
      try {
        const projects = await listProjectSummaryForUserAgent({
          userId: auth.principalId,
          agentId,
          limit,
        });
        return json({ ok: true, projects }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to list projects",
          },
          500,
          request,
        );
      }
    }),

    GET("/api/projects", async (request) => {
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
      const agentId = new URL(request.url).searchParams.get("agentId")?.trim();
      if (!agentId) {
        return json(
          { ok: false, error: "agentId query parameter is required" },
          400,
          request,
        );
      }
      try {
        const projects = await listProjectsForUserAgent({
          userId: auth.principalId,
          agentId,
        });
        return json({ ok: true, projects }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to list projects",
          },
          500,
          request,
        );
      }
    }),

    GET("/api/project-workspace-file-refs/:projectId", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      try {
        const workspaceFileIds = await listProjectWorkspaceFileRefsForUser({
          userId: auth.principalId,
          projectId: params.projectId,
        });
        return json({ ok: true, workspaceFileIds }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error
                ? err.message
                : "Failed to list project context files",
          },
          500,
          request,
        );
      }
    }),

    PUT("/api/project-workspace-file-refs/:projectId", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      let body: { workspaceFileIds?: string[] };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      try {
        const workspaceFileIds = await replaceProjectWorkspaceFileRefsForUser({
          userId: auth.principalId,
          projectId: params.projectId,
          workspaceFileIds: body.workspaceFileIds ?? [],
        });
        return json({ ok: true, workspaceFileIds }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error
                ? err.message
                : "Failed to update project context files",
          },
          400,
          request,
        );
      }
    }),

    POST("/api/projects", async (request) => {
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
      let body: { agentId?: string; name?: string; instructions?: string };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      if (!body.name?.trim()) {
        return json({ ok: false, error: "name is required" }, 400, request);
      }
      try {
        const agentId = resolveRegisteredAgentId(body.agentId);
        const project = await createProjectForUser({
          userId: auth.principalId,
          agentId,
          name: body.name,
          instructions: body.instructions,
        });
        return json({ ok: true, project }, 201, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to create project",
          },
          400,
          request,
        );
      }
    }),

    GET("/api/projects/detail/:id", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      const agentId = readAgentIdFromQuery(request);
      if (!agentId) {
        return json(
          { ok: false, error: "agentId query parameter is required" },
          400,
          request,
        );
      }
      try {
        const project = await getProjectForUserAgent({
          userId: auth.principalId,
          projectId: params.id,
          agentId,
        });
        if (!project) {
          return json({ ok: false, error: "Project not found" }, 404, request);
        }
        return json({ ok: true, project }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to load project",
          },
          500,
          request,
        );
      }
    }),

    PUT("/api/projects/detail/:id", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      let body: { name?: string; instructions?: string };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      const agentId = readAgentIdFromQuery(request);
      if (!agentId) {
        return json(
          { ok: false, error: "agentId query parameter is required" },
          400,
          request,
        );
      }
      try {
        const project = await updateProjectForUserAgent({
          userId: auth.principalId,
          projectId: params.id,
          agentId,
          name: body.name,
          instructions: body.instructions,
        });
        if (!project) {
          return json({ ok: false, error: "Project not found" }, 404, request);
        }
        return json({ ok: true, project }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to update project",
          },
          400,
          request,
        );
      }
    }),

    DELETE("/api/projects/detail/:id", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      const agentId = readAgentIdFromQuery(request);
      if (!agentId) {
        return json(
          { ok: false, error: "agentId query parameter is required" },
          400,
          request,
        );
      }
      try {
        const ok = await deleteProjectForUserAgent({
          userId: auth.principalId,
          projectId: params.id,
          agentId,
        });
        if (!ok) {
          return json({ ok: false, error: "Project not found" }, 404, request);
        }
        return json({ ok: true }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to delete project",
          },
          500,
          request,
        );
      }
    }),

    POST("/api/chat-sessions/bind", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      let body: {
        eveSessionId?: string;
        agentId?: string;
        projectId?: string | null;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      const eveSessionId = body.eveSessionId?.trim();
      const agentId = body.agentId?.trim();
      if (!eveSessionId || !agentId) {
        return json(
          { ok: false, error: "eveSessionId and agentId are required" },
          400,
          request,
        );
      }
      try {
        await bindChatSessionForUser({
          userId: auth.principalId,
          agentId,
          eveSessionId,
          projectId: body.projectId ?? null,
        });
        return json({ ok: true }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to bind chat session",
          },
          400,
          request,
        );
      }
    }),
  ];
}
