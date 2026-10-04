import {
  INTEGRATION_CATALOG,
  type IntegrationDefinition,
} from "../../domain/integration/integration-catalog.js";
import { listWiredIntegrationIdsForPlatformAgent } from "../../infrastructure/agents/list-wired-integration-ids.js";

/** Customize UI + OAuth scope: catalog entries that have a matching Eve connection file. */
export function integrationsForAgent(
  platformAgentId: string,
): IntegrationDefinition[] {
  const wired = new Set(
    listWiredIntegrationIdsForPlatformAgent(platformAgentId),
  );
  return INTEGRATION_CATALOG.filter((row) => wired.has(row.id));
}
