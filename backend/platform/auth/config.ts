/** Shared JWT / auth constants for platform login and Eve channel verification. */

export const JWT_ISSUER = "cow-eve";
export const JWT_AUDIENCE = "agent-platform";
export const JWT_ALGORITHM = "HS256" as const;

/** True while Eve is evaluating agent modules for a Vercel build output. */
function isEveVercelBuild(): boolean {
  return Boolean(
    process.env.EVE_INTERNAL_BUILD_OUTPUT_DIRECTORY ||
      process.env.EVE_INTERNAL_HOST_BUILD_OUTPUT_DIRECTORY,
  );
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }

  // `eve build` on Vercel imports channel modules with VERCEL=1. Project secrets
  // are often Runtime-only, so allow a build-time placeholder during graph
  // discovery. Cold starts re-import with runtime env and must have JWT_SECRET.
  if (isEveVercelBuild()) {
    return "cow-eve-build-placeholder-secret";
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("JWT_SECRET must be set to a strong value in production");
  }
  return "cow-eve-dev-jwt-secret-change-me";
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
