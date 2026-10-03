import { GET, PUT, type RouteDefinition } from "eve/channels";
import {
  getDatabaseUrl,
  getKbPreferencesForUser,
  listKnowledgeBasesForUser,
  setKbPreferencesForUser,
} from "../../../composition/public-api.js";
import { HybridSearchKbClientError } from "../../../infrastructure/integration/hybrid-search-kb.client.js";
import type { PlatformRouteContext } from "../platform-route-context.js";
import { resolveRegisteredAgentId } from "../helpers/agent-scope.js";

function readProjectIdFromQuery(request: Request): string | null {
  const value = new URL(request.url).searchParams.get("projectId")?.trim();
  return value || null;
}

export function registerKbRoutes(ctx: PlatformRouteContext): RouteDefinition[] {
  const { json, preflight, requireUser } = ctx;

  return [
    preflight("/api/agents/:agentId/knowledge-bases"),
    preflight("/api/agents/:agentId/kb-preferences"),

    GET("/api/agents/:agentId/knowledge-bases", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "Database is not configured" },
          503,
          request,
        );
      }
      let agentId: string;
      try {
        agentId = resolveRegisteredAgentId(params.agentId);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Invalid agent",
          },
          400,
          request,
        );
      }
      const projectId = readProjectIdFromQuery(request);
      try {
        const result = await listKnowledgeBasesForUser({
          userId: auth.principalId,
          agentId,
          projectId,
        });
        return json({ ok: true, ...result }, 200, request);
      } catch (err) {
        if (err instanceof HybridSearchKbClientError) {
          const status = err.statusCode === 401 || err.statusCode === 403 ? err.statusCode : 502;
          return json({ ok: false, error: err.message }, status, request);
        }
        return json(
          {
            ok: false,
            error:
              err instanceof Error
                ? err.message
                : "Failed to list knowledge bases",
          },
          500,
          request,
        );
      }
    }),

    GET("/api/agents/:agentId/kb-preferences", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "Database is not configured" },
          503,
          request,
        );
      }
      let agentId: string;
      try {
        agentId = resolveRegisteredAgentId(params.agentId);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Invalid agent",
          },
          400,
          request,
        );
      }
      const projectId = readProjectIdFromQuery(request);
      try {
        const prefs = await getKbPreferencesForUser({
          userId: auth.principalId,
          agentId,
          projectId,
        });
        return json({ ok: true, ...prefs }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to load preferences",
          },
          err instanceof Error && err.message === "Project not found."
            ? 404
            : 500,
          request,
        );
      }
    }),

    PUT("/api/agents/:agentId/kb-preferences", async (request, { params }) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      if (!getDatabaseUrl()) {
        return json(
          { ok: false, error: "Database is not configured" },
          503,
          request,
        );
      }
      let agentId: string;
      try {
        agentId = resolveRegisteredAgentId(params.agentId);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Invalid agent",
          },
          400,
          request,
        );
      }
      let body: { disabledKbIds?: string[]; projectId?: string | null };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      const projectId =
        typeof body.projectId === "string" && body.projectId.trim()
          ? body.projectId.trim()
          : readProjectIdFromQuery(request);
      try {
        const prefs = await setKbPreferencesForUser({
          userId: auth.principalId,
          agentId,
          projectId,
          disabledKbIds: body.disabledKbIds ?? [],
        });
        return json({ ok: true, ...prefs }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to save preferences",
          },
          err instanceof Error && err.message === "Project not found."
            ? 404
            : 400,
          request,
        );
      }
    }),
  ];
}
