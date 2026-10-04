import {
  getIntegrationDefinition,
  type IntegrationDefinition,
} from "./integration-catalog.js";

export type IntegrationCredentialScope = "user" | "agent";

export function integrationCredentialScope(
  def: IntegrationDefinition,
): IntegrationCredentialScope {
  return def.scope ?? "user";
}

export function integrationCredentialScopeForId(
  integrationId: string,
): IntegrationCredentialScope {
  const def = getIntegrationDefinition(integrationId);
  if (!def) return "user";
  return integrationCredentialScope(def);
}

export function requireAgentIdForIntegration(
  integrationId: string,
  agentId: string | undefined,
): string {
  const scope = integrationCredentialScopeForId(integrationId);
  if (scope !== "agent") return "";
  const trimmed = agentId?.trim();
  if (!trimmed) {
    throw new Error("agentId is required for this integration.");
  }
  return trimmed;
}
