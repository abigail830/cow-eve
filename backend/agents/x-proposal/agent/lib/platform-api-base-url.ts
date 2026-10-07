/** Base URL for platform OpenAPI connections (projects, schedules). */
export function resolvePlatformApiBaseUrl(): string {
  const explicit = process.env.PLATFORM_API_BASE_URL?.trim();
  if (explicit) return asHttpsOrigin(explicit);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return asHttpsOrigin(production);

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return asHttpsOrigin(vercel);

  return "http://127.0.0.1:2000";
}

function asHttpsOrigin(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
