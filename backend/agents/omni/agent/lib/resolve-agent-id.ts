import { resolveAgentIdForEveSession } from "#platform/composition/public-api.js";

/** Platform chat agent id for this Eve session (Customize / integrations scope). */
export async function resolveAgentIdForSession(input: {
  userId: string;
  eveSessionId: string;
}): Promise<string | null> {
  return resolveAgentIdForEveSession(input);
}
