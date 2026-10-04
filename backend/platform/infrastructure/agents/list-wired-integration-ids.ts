import fs from "node:fs";
import path from "node:path";
import { findBackendRoot } from "../config/backend-root.js";
import { getAgent } from "../../domain/registry/agent.entity.js";

/** `agent/connections/notion.ts` → catalog id `notion`; `hybrid-search.ts` → `hybrid_search`. */
export function connectionFilenameToIntegrationId(filename: string): string {
  const base = filename.replace(/\.tsx?$/, "");
  return base.replace(/-/g, "_");
}

/**
 * Integration ids wired in Eve for a platform sidebar agent (via registry → agents/<eveAgent>/agent/connections/).
 */
export function listWiredIntegrationIdsForPlatformAgent(
  platformAgentId: string,
): readonly string[] {
  const entry = getAgent(platformAgentId);
  if (!entry) return [];

  const connectionsDir = path.join(
    findBackendRoot(),
    "agents",
    entry.eveAgent,
    "agent",
    "connections",
  );
  if (!fs.existsSync(connectionsDir)) return [];

  const ids: string[] = [];
  for (const name of fs.readdirSync(connectionsDir)) {
    if (!/\.tsx?$/.test(name) || name.includes(".test.")) continue;
    ids.push(connectionFilenameToIntegrationId(name));
  }
  return ids;
}
