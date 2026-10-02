import { GET, type RouteDefinition } from "eve/channels";
import { listAgents } from "../../../composition/public-api.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

export function registerAgentsRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { json, preflight, requireUser } = ctx;

  return [
    preflight("/api/agents"),

    GET("/api/agents", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      return json({ ok: true, agents: listAgents() }, 200, request);
    }),
  ];
}
