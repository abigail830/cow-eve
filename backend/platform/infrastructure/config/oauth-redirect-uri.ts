import { getParsePipelinePublicBaseUrl } from "./parse-pipeline.config.js";

/** HubSpot/Notion reject http on public hosts (e.g. *.vercel.app). */
export function normalizeOAuthRedirectUri(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  let uri = raw.trim();
  try {
    const u = new URL(uri);
    const host = u.hostname.toLowerCase();
    const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (!isLoopback && u.protocol === "http:") {
      u.protocol = "https:";
      uri = u.href;
    }
    if (u.pathname.endsWith("/") && u.pathname.length > 1) {
      u.pathname = u.pathname.replace(/\/+$/, "") || "/";
      uri = u.href;
    }
    return uri;
  } catch {
    return uri;
  }
}

export function resolveIntegrationOAuthRedirectUri(input: {
  integrationId: string;
  envRedirectUri: string | undefined;
}): string | null {
  const fromEnv = normalizeOAuthRedirectUri(input.envRedirectUri?.trim() || null);
  if (fromEnv) return fromEnv;

  const base = getParsePipelinePublicBaseUrl();
  if (!base) return null;
  return normalizeOAuthRedirectUri(
    `${base.replace(/\/$/, "")}/api/integrations/${input.integrationId}/callback`,
  );
}
