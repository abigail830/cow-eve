/** Shared JWT / auth constants for platform login and Eve channel verification. */

export const JWT_ISSUER = "cow-eve";
export const JWT_AUDIENCE = "agent-platform";
export const JWT_ALGORITHM = "HS256" as const;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      throw new Error("JWT_SECRET must be set to a strong value in production");
    }
    return "cow-eve-dev-jwt-secret-change-me";
  }
  return secret;
}

const DEFAULT_FRONTEND_ORIGINS = [
  "http://127.0.0.1:5273",
  "http://localhost:5273",
];

/** Allowed browser origins for CORS (comma-separated FRONTEND_ORIGIN). */
export function getFrontendOrigins(): string[] {
  const raw = process.env.FRONTEND_ORIGIN?.trim();
  if (!raw) return [...DEFAULT_FRONTEND_ORIGINS];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

/** Pick Access-Control-Allow-Origin for an inbound request. */
export function resolveCorsOrigin(requestOrigin: string | null): string {
  const allowed = getFrontendOrigins();
  if (requestOrigin && allowed.includes(requestOrigin)) {
    return requestOrigin;
  }
  return allowed[0] ?? DEFAULT_FRONTEND_ORIGINS[0];
}
