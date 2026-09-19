/** Shared JWT / auth constants for platform login and Eve channel verification. */

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
  "https://fde-desk.vercel.app",
];

/** Allowed browser origins for CORS (defaults + comma-separated FRONTEND_ORIGIN). */
export function getFrontendOrigins(): string[] {
  const allowed = new Set(DEFAULT_FRONTEND_ORIGINS);
  const raw = process.env.FRONTEND_ORIGIN?.trim();
  if (raw) {
    for (const origin of raw.split(",")) {
      const normalized = origin.trim().replace(/\/$/, "");
      if (normalized) allowed.add(normalized);
    }
  }
  return [...allowed];
}

/** Pick Access-Control-Allow-Origin for an inbound request. */
export function resolveCorsOrigin(requestOrigin: string | null): string {
  const allowed = getFrontendOrigins();
  if (requestOrigin && allowed.includes(requestOrigin)) {
    return requestOrigin;
  }
  return allowed[0] ?? DEFAULT_FRONTEND_ORIGINS[0];
}
