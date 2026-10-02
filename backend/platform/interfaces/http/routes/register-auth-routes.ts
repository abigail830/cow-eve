import { GET, POST, type RouteDefinition } from "eve/channels";
import {
  findUserByEmail,
  loginWithPassword,
} from "../../../composition/public-api.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

export function registerAuthRoutes(ctx: PlatformRouteContext): RouteDefinition[] {
  const { json, preflight, requireUser } = ctx;

  return [
    preflight("/api/auth/login"),
    preflight("/api/auth/me"),

    POST("/api/auth/login", async (request) => {
      let body: { email?: string; password?: string };
      try {
        body = (await request.json()) as { email?: string; password?: string };
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      const email = body.email?.trim() ?? "";
      const password = body.password ?? "";
      if (!email || !password) {
        return json(
          { ok: false, error: "Email and password are required" },
          400,
          request,
        );
      }

      const result = await loginWithPassword(email, password);
      if ("error" in result) {
        return json({ ok: false, error: result.error }, 401, request);
      }

      return json(
        { ok: true, token: result.token, user: result.user },
        200,
        request,
      );
    }),

    GET("/api/auth/me", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      const user = await findUserByEmail(auth.principalId);
      return json(
        {
          ok: true,
          user: {
            email: auth.principalId,
            displayName: user?.displayName ?? auth.principalId,
          },
        },
        200,
        request,
      );
    }),
  ];
}
