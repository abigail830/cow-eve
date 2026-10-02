import { GET, type RouteDefinition } from "eve/channels";
import { getParsePipelineDiagnostics } from "../../../infrastructure/config/parse-pipeline.config.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

export function registerHealthRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { json, preflight } = ctx;

  return [
    preflight("/api/health"),

    GET("/api/health", async (request) => {
      return json(
        {
          ok: true,
          vercel: Boolean(process.env.VERCEL),
          parsePipeline: getParsePipelineDiagnostics(),
        },
        200,
        request,
      );
    }),
  ];
}
