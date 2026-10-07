/** Strip trailing slash and accidental `/eve/<agent>` suffix from platform API base. */
function normalizeApiUrl(raw: string | undefined): string {
  const fallback = "http://127.0.0.1:2000";
  if (!raw?.trim()) return fallback;
  let url = raw.trim().replace(/\/$/, "");
  // Production mistake: pointing API at the Eve agent mount instead of host root.
  url = url.replace(/\/eve\/[^/]+$/i, "");
  return url || fallback;
}

export const API_URL = normalizeApiUrl(
  import.meta.env.VITE_API_URL as string | undefined,
);

/** Comma list: omni=http://127.0.0.1:2000 */
function parseAgentUrls(): Record<string, string> {
  const raw = import.meta.env.VITE_AGENT_URLS as string | undefined;
  if (!raw) {
    return {
      omni: "http://127.0.0.1:2000",
    };
  }
  return Object.fromEntries(
    raw.split(",").map((pair) => {
      const [id, url] = pair.split("=").map((s) => s.trim());
      return [id, url.replace(/\/$/, "")];
    }),
  );
}

export const AGENT_URLS = parseAgentUrls();

const LOCAL_AGENT_DEV_URLS: Record<string, string> = {
  omni: "http://127.0.0.1:2000",
  research: "http://127.0.0.1:2002",
  "nova-auditor": "http://127.0.0.1:2003",
  "x-proposal": "http://127.0.0.1:2004",
};

/** Eve session base URL for an agent (local dev: dedicated port; production: `/eve/<id>` on platform host). */
export function agentHost(agentId: string): string {
  const explicit = AGENT_URLS[agentId]?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const id = agentId.trim();
  const localDefault = LOCAL_AGENT_DEV_URLS[id];
  if (localDefault && /127\.0\.0\.1|localhost/.test(API_URL)) {
    return localDefault;
  }
  const base = API_URL.replace(/\/$/, "");
  return `${base}/eve/${id}`;
}
