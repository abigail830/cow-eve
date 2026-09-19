import {
  jwtHmac,
  localDev,
  vercelOidc,
  type AuthFn,
} from "eve/channels/auth";
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  getFrontendOrigins,
  getJwtSecret,
} from "./config";

/** Platform JWT first, then Vercel OIDC / local dev fallbacks. */
export function platformRouteAuth(): AuthFn<Request>[] {
  return [
    jwtHmac({
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audiences: [JWT_AUDIENCE],
      secret: getJwtSecret(),
    }),
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
