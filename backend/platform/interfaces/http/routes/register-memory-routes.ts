import { GET, type RouteDefinition } from "eve/channels";
import { getUserMemorySnapshot } from "../../../composition/public-api.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

export function registerMemoryRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { json, preflight, requireUser } = ctx;

  return [
    preflight("/api/memory"),

    GET("/api/memory", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }

      const url = new URL(request.url);
      const agentId = url.searchParams.get("agentId")?.trim() || "omni";

      try {
        const memory = await getUserMemorySnapshot({
          userEmail: auth.principalId,
          agentId,
        });
        return json({ ok: true, memory }, 200, request);
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to load memory",
          },
          500,
          request,
        );
      }
    }),
  ];
}
