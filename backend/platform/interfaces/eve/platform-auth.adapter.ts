import {
  extractBearerToken,
  localDev,
  UnauthenticatedError,
  vercelOidc,
  verifyJwtHmac,
  type AuthFn,
} from "eve/channels/auth";
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from "../../domain/auth/auth.constants";
import {
  getFrontendOrigins,
  getJwtSecret,
} from "../../infrastructure/config/env.config";

/** Preserved on session auth for outbound platform OpenAPI connections. */
export const PLATFORM_ACCESS_TOKEN_ATTR = "platformAccessToken";

function withPlatformAccessToken(authFn: AuthFn<Request>): AuthFn<Request> {
  return async (request) => {
    const result = await authFn(request);
    if (!result) return null;

    const bearer = extractBearerToken(request.headers.get("authorization"));
    if (!bearer) return result;

    return {
      ...result,
      attributes: {
        ...result.attributes,
        [PLATFORM_ACCESS_TOKEN_ATTR]: bearer,
      },
    };
  };
}

/**
 * Cow Eve login JWT (HS256). Eve's built-in `jwtHmac()` authenticator marks
 * callers as `principalType: "service"`; browser sessions need `user` for
 * user-scoped connections (see Eve auth guide — custom AuthFn with user principal).
 */
function platformLoginUserJwt(): AuthFn<Request> {
  return withPlatformAccessToken(async (request) => {
    const bearer = extractBearerToken(request.headers.get("authorization"));
    if (!bearer) return null;

    const result = await verifyJwtHmac(bearer, {
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audiences: [JWT_AUDIENCE],
      secret: getJwtSecret(),
    });

    if (!result.ok) {
      throw new UnauthenticatedError({
        code: "invalid_token",
        message: "Sign in again to continue.",
      });
    }

    return {
      ...result.sessionAuth,
      principalType: "user",
    };
  });
}

/** Platform login JWT first, then Vercel OIDC / local dev fallbacks. */
export function platformRouteAuth(): AuthFn<Request>[] {
  return [platformLoginUserJwt(), vercelOidc(), localDev()];
}

export function platformCors() {
  return {
    origin: getFrontendOrigins(),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] as const,
    allowedHeaders: ["authorization", "content-type"] as const,
  };
}
