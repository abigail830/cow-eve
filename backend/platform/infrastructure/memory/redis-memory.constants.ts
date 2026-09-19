/**
 * Upstash Redis Search caps index count (often 1 on dev tiers).
 * All agent memory slots share one index; keys stay isolated per agent via prefix.
 */
export const REDIS_MEMORY_INDEX_NAME = "agentkit_memorySlot";

export function redisMemoryPrefix(agentId: string): string {
  return `agentkit:memorySlot:${agentId}`;
}
