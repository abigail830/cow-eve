import {
  extractBearerToken,
  jwtHmac,
  localDev,
  vercelOidc,
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

/** Platform JWT first, then Vercel OIDC / local dev fallbacks. */
export function platformRouteAuth(): AuthFn<Request>[] {
  return [
    withPlatformAccessToken(
      jwtHmac({
        algorithm: JWT_ALGORITHM,
        issuer: JWT_ISSUER,
        audiences: [JWT_AUDIENCE],
        secret: getJwtSecret(),
      }),
    ),
    vercelOidc(),
    localDev(),
  ];
}

export function platformCors() {
  return {
    origin: getFrontendOrigins(),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] as const,
    allowedHeaders: ["authorization", "content-type"] as const,
  };
}
