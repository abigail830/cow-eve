import { GET, PUT, type RouteDefinition } from "eve/channels";
import {
  getDatabaseUrl,
  listIntegrationsForUser,
  saveUserIntegration,
} from "../../../composition/public-api.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

export function registerIntegrationRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { json, preflight, requireUser } = ctx;

  return [
    preflight("/api/integrations"),
    preflight("/api/integrations/:id"),

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
      try {
        const integration = await saveUserIntegration({
          userId: auth.principalId,
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
