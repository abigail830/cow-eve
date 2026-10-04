import { GET, POST, PUT, type RouteDefinition } from "eve/channels";
import {
  getDatabaseUrl,
  listIntegrationsForUser,
  saveUserIntegration,
} from "../../../composition/public-api.js";
import {
  beginIntegrationOAuth,
  completeIntegrationOAuth,
  disconnectIntegrationOAuth,
  integrationOAuthCallbackRedirect,
} from "../../../application/integration/integration-oauth.use-case.js";
import { getIntegrationDefinition } from "../../../domain/integration/integration-catalog.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  });
}

export function registerIntegrationRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { json, preflight, requireUser } = ctx;

  return [
    preflight("/api/integrations"),
    preflight("/api/integrations/:id"),
    preflight("/api/integrations/:id/connect"),
    preflight("/api/integrations/:id/disconnect"),
    preflight("/api/integrations/:id/callback"),

    GET("/api/integrations", async (request) => {
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
      const agentId = url.searchParams.get("agentId")?.trim() || undefined;
      try {
        const integrations = await listIntegrationsForUser({
          userId: auth.principalId,
          agentId,
        });
        return json({ ok: true, integrations }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error:
              err instanceof Error ? err.message : "Failed to load integrations",
          },
          500,
          request,
        );
      }
    }),

    POST("/api/integrations/:id/connect", async (request, { params }) => {
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
      const def = getIntegrationDefinition(params.id);
      if (!def || def.authKind !== "oauth") {
        return json({ ok: false, error: "Unknown integration." }, 404, request);
      }
      let agentId: string | undefined;
      try {
        const body = (await request.json()) as { agentId?: string };
        agentId = body.agentId?.trim() || undefined;
      } catch {
        agentId = undefined;
      }
      try {
        const { authorizeUrl } = await beginIntegrationOAuth({
          userId: auth.principalId,
          integrationId: params.id,
          agentId,
        });
        return json({ ok: true, authorizeUrl }, 200, request);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to start OAuth";
        const status = message === "Unknown integration." ? 404 : 400;
        return json({ ok: false, error: message }, status, request);
      }
    }),

    GET("/api/integrations/:id/callback", async (request, { params }) => {
      const url = new URL(request.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");
      if (error) {
        const message = (errorDescription ?? error).replace(/\+/g, " ");
        return redirectResponse(
          integrationOAuthCallbackRedirect({
            integrationId: params.id,
            status: "error",
            error: message,
          }),
        );
      }
      if (!code || !state) {
        return redirectResponse(
          integrationOAuthCallbackRedirect({
            integrationId: params.id,
            status: "error",
            error: "Missing OAuth code or state.",
          }),
        );
      }
      if (!getDatabaseUrl()) {
        return redirectResponse(
          integrationOAuthCallbackRedirect({
            integrationId: params.id,
            status: "error",
            error: "Database is not configured.",
          }),
        );
      }
      try {
        const result = await completeIntegrationOAuth({
          integrationId: params.id,
          code,
          state,
        });
        return redirectResponse(
          integrationOAuthCallbackRedirect({
            integrationId: params.id,
            status: "connected",
            agentId: result.agentId,
          }),
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "OAuth callback failed.";
        return redirectResponse(
          integrationOAuthCallbackRedirect({
            integrationId: params.id,
            status: "error",
            error: message,
          }),
        );
      }
    }),

    POST("/api/integrations/:id/disconnect", async (request, { params }) => {
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
      const def = getIntegrationDefinition(params.id);
      if (!def || def.authKind !== "oauth") {
        return json({ ok: false, error: "Unknown integration." }, 404, request);
      }
      let agentId: string | undefined;
      try {
        const body = (await request.json()) as { agentId?: string };
        agentId = body.agentId?.trim() || undefined;
      } catch {
        agentId = undefined;
      }
      try {
        const disconnected = await disconnectIntegrationOAuth({
          userId: auth.principalId,
          integrationId: params.id,
          agentId,
        });
        return json({ ok: true, disconnected }, 200, request);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to disconnect";
        return json({ ok: false, error: message }, 400, request);
      }
    }),

    PUT("/api/integrations/:id", async (request, { params }) => {
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
        secrets?: Record<string, string | undefined>;
        config?: Record<string, string | undefined>;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }
      const url = new URL(request.url);
      const agentId = url.searchParams.get("agentId")?.trim();
      if (!agentId) {
        return json({ ok: false, error: "agentId is required." }, 400, request);
      }
      try {
        const integration = await saveUserIntegration({
          userId: auth.principalId,
          agentId,
          integrationId: params.id,
          secrets: body.secrets,
          config: body.config,
        });
        return json({ ok: true, integration }, 200, request);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save integration";
        const status = message === "Unknown integration." ? 404 : 400;
        return json({ ok: false, error: message }, status, request);
      }
    }),
  ];
}
