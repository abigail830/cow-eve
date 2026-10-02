import { OPTIONS, type RouteDefinition } from "eve/channels";
import { extractBearerToken, verifyJwtHmac } from "eve/channels/auth";
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  getDatabaseUrl,
  getJwtSecret,
  resolveCorsOrigin,
} from "../../composition/public-api.js";

export type PlatformSessionAuth = {
  principalId: string;
};

export type PlatformRouteContext = {
  json: (data: unknown, status?: number, request?: Request) => Response;
  withCors: (response: Response, request?: Request) => Response;
  corsHeaders: (request?: Request) => HeadersInit;
  preflight: (path: string) => RouteDefinition;
  requireUser: (request: Request) => Promise<PlatformSessionAuth | null>;
  requireUserAndDb: (
    request: Request,
  ) => Promise<PlatformSessionAuth | Response>;
};

function buildCorsHeaders(request?: Request): HeadersInit {
  return {
    "Access-Control-Allow-Origin": resolveCorsOrigin(
      request?.headers.get("origin") ?? null,
    ),
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function createPlatformRouteContext(): PlatformRouteContext {
  const json = (data: unknown, status = 200, request?: Request): Response =>
    Response.json(data, { status, headers: buildCorsHeaders(request) });

  const withCors = (response: Response, request?: Request): Response => {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(buildCorsHeaders(request))) {
      headers.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };

  const preflight = (path: string): RouteDefinition =>
    OPTIONS(path, async (request) =>
      new Response(null, { status: 204, headers: buildCorsHeaders(request) }),
    );

  const requireUser = async (
    request: Request,
  ): Promise<PlatformSessionAuth | null> => {
    const token = extractBearerToken(request.headers.get("authorization"));
    const result = await verifyJwtHmac(token, {
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audiences: [JWT_AUDIENCE],
      secret: getJwtSecret(),
    });
    if (!result.ok) return null;
    return { principalId: result.sessionAuth.principalId };
  };

  const requireUserAndDb = async (
    request: Request,
  ): Promise<PlatformSessionAuth | Response> => {
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
    return auth;
  };

  return {
    json,
    withCors,
    corsHeaders: buildCorsHeaders,
    preflight,
    requireUser,
    requireUserAndDb,
  };
}
