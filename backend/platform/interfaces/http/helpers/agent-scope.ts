import { getAgent } from "../../../domain/registry/agent.entity.js";

export function readAgentIdFromQuery(request: Request): string | null {
  const value = new URL(request.url).searchParams.get("agentId")?.trim();
  return value || null;
}

export function resolveRegisteredAgentId(raw: string | undefined | null): string {
  const agentId = raw?.trim() || "omni";
  if (!getAgent(agentId)) {
    throw new Error(`Unknown agentId: ${agentId}`);
  }
  return agentId;
}
