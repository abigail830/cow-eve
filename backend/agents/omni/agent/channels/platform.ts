import { defineChannel, GET, OPTIONS, POST, PUT } from "eve/channels";
import { extractBearerToken, verifyJwtHmac } from "eve/channels/auth";
import { loginWithPassword } from "../../../../platform/auth/login";
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  getJwtSecret,
  resolveCorsOrigin,
} from "../../../../platform/auth/config";
import { findUserByEmail } from "../../../../platform/auth/users";
import { listAgents } from "../../../../platform/registry/agents";
import {
  MODEL_PRESETS,
  applyModelSettingsUpdate,
  loadModelSettings,
  saveModelSettings,
  toPublicSettings,
  type ModelSettingsUpdate,
} from "../../../../platform/settings/model-store";

function corsHeaders(request?: Request): HeadersInit {
  return {
    "Access-Control-Allow-Origin": resolveCorsOrigin(
      request?.headers.get("origin") ?? null,
    ),
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200, request?: Request): Response {
  return Response.json(data, { status, headers: corsHeaders(request) });
}

function preflight(path: string) {
  return OPTIONS(path, async (request) =>
    new Response(null, { status: 204, headers: corsHeaders(request) }),
  );
}

async function requireUser(request: Request) {
  const token = extractBearerToken(request.headers.get("authorization"));
  const result = await verifyJwtHmac(token, {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audiences: [JWT_AUDIENCE],
    secret: getJwtSecret(),
  });
  if (!result.ok) return null;
  return result.sessionAuth;
}

export default defineChannel({
  routes: [
    preflight("/api/auth/login"),
    preflight("/api/auth/me"),
    preflight("/api/agents"),
    preflight("/api/settings/model"),
    preflight("/api/settings/model/presets"),

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
      const user = findUserByEmail(auth.principalId);
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
    GET("/api/agents", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      return json({ ok: true, agents: listAgents() }, 200, request);
    }),

    GET("/api/settings/model/presets", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      return json({ ok: true, presets: MODEL_PRESETS }, 200, request);
    }),

    GET("/api/settings/model", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }
      return json(
        {
          ok: true,
          settings: toPublicSettings(loadModelSettings()),
        },
        200,
        request,
      );
    }),

    PUT("/api/settings/model", async (request) => {
      const auth = await requireUser(request);
      if (!auth) {
        return json({ ok: false, error: "Unauthorized" }, 401, request);
      }

      let body: ModelSettingsUpdate;
      try {
        body = (await request.json()) as ModelSettingsUpdate;
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400, request);
      }

      try {
        const next = applyModelSettingsUpdate(loadModelSettings(), body);
        const saved = saveModelSettings(next);
        return json(
          { ok: true, settings: toPublicSettings(saved) },
          200,
          request,
        );
      } catch (err) {
        return json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to save settings",
          },
          400,
          request,
        );
      }
    }),
  ],
});
