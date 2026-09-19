export const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:2000";

/** Comma list: omni=http://127.0.0.1:2000,content-studio=http://127.0.0.1:2001 */
function parseAgentUrls(): Record<string, string> {
  const raw = import.meta.env.VITE_AGENT_URLS as string | undefined;
  if (!raw) {
    return {
      omni: "http://127.0.0.1:2000",
      "content-studio": "http://127.0.0.1:2001",
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

export function agentHost(agentId: string): string {
  return AGENT_URLS[agentId] ?? API_URL;
}
