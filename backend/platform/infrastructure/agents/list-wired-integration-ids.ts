import fs from "node:fs";
import path from "node:path";
import { findBackendRoot } from "../config/backend-root.js";
import { getAgent } from "../../domain/registry/agent.entity.js";
import { WIRED_INTEGRATION_IDS_BY_EVE_AGENT } from "./wired-integrations.manifest.js";

/** `agent/connections/notion.ts` → catalog id `notion`; `hybrid-search.ts` → `hybrid_search`. */
export function connectionFilenameToIntegrationId(filename: string): string {
  const base = filename.replace(/\.tsx?$/, "");
  return base.replace(/-/g, "_");
}

/**
 * Integration ids wired in Eve for a platform sidebar agent (via registry → agents/<eveAgent>/agent/connections/).
 */
function scanConnectionsDir(eveAgent: string): string[] {
  const connectionsDir = path.join(
    findBackendRoot(),
    "agents",
    eveAgent,
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

export function listWiredIntegrationIdsForPlatformAgent(
  platformAgentId: string,
): readonly string[] {
  const entry = getAgent(platformAgentId);
  if (!entry) return [];

  const fromDisk = scanConnectionsDir(entry.eveAgent);
  if (fromDisk.length > 0) return fromDisk;

  return WIRED_INTEGRATION_IDS_BY_EVE_AGENT[entry.eveAgent] ?? [];
}
