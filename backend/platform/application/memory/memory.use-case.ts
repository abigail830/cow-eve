import type { UserMemorySnapshot } from "../../domain/memory/memory.entity";
import { readUserMemorySnapshot } from "../../infrastructure/memory/redis-memory-reader";

export type { MemoryEntry, PreferenceEntry, UserMemorySnapshot } from "../../domain/memory/memory.entity";

export async function getUserMemorySnapshot(input: {
  userEmail: string;
  agentId: string;
}): Promise<UserMemorySnapshot> {
  return readUserMemorySnapshot(input);
}
