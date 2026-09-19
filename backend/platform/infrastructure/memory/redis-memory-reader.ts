import { Redis } from "@upstash/redis";
import type {
  MemoryEntry,
  PreferenceEntry,
  UserMemorySnapshot,
} from "../../domain/memory/memory.entity";
import {
  memoryScopeKeyForEmail,
  toRedisKeyPart,
} from "./scope-key";
import { redisMemoryPrefix } from "./redis-memory.constants";

const CONTENT_MARKER = "eve-memory-document-v1:";
const MEMORY_DOCUMENT_HEADER =
  /^<!-- eve-memory-file-v1 lastAllocatedIndex=(-1|0|[1-9]\d*) -->\n/;

const PREFERENCES_DOC_PREFIX = "agentkit:memoryFile:preferences";

function getRedis(): Redis | null {
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

function parsePreferenceDocument(raw: string): PreferenceEntry[] {
  const match = MEMORY_DOCUMENT_HEADER.exec(raw);
  if (!match) return [];
  const body = raw.slice(match[0].length);
  if (body.length === 0) return [];
  const lines = body.endsWith("\n") ? body.slice(0, -1).split("\n") : body.split("\n");
  const entries: PreferenceEntry[] = [];
  for (const line of lines) {
    const row = /^(\d+): (.+)$/.exec(line);
    if (!row) continue;
    entries.push({ index: Number(row[1]), text: row[2] });
  }
  return entries.sort((a, b) => a.index - b.index);
}

async function readGlobalPreferences(
  redis: Redis,
  scopeKey: string,
): Promise<PreferenceEntry[]> {
  const stored = await redis.hmget(
    `${PREFERENCES_DOC_PREFIX}:${scopeKey}`,
    "content",
    "version",
  );
  if (!stored || typeof stored.content !== "string") return [];
  const content = stored.content.startsWith(CONTENT_MARKER)
    ? stored.content.slice(CONTENT_MARKER.length)
    : stored.content;
  return parsePreferenceDocument(content);
}

/** Read agent memories via Redis keys — avoids creating extra Search indexes. */
async function readAgentMemories(
  redis: Redis,
  agentId: string,
  userId: string,
): Promise<MemoryEntry[]> {
  const keyPrefix = `${redisMemoryPrefix(agentId)}:${userId}:`;
  const keys: string[] = [];
  let cursor = 0;

  do {
    const [nextCursor, batch] = await redis.scan(cursor, {
      match: `${keyPrefix}*`,
      count: 100,
    });
    cursor = Number(nextCursor);
    keys.push(...batch);
  } while (cursor !== 0);

  const entries: MemoryEntry[] = [];
  for (const key of keys) {
    const data = await redis.json.get(key);
    if (data === null || typeof data !== "object") continue;

    const doc = data as Record<string, unknown>;
    if (doc.deleted === true) continue;

    const text = typeof doc.text === "string" ? doc.text : "";
    if (!text.trim()) continue;

    const id = key.startsWith(keyPrefix) ? key.slice(keyPrefix.length) : key;
    entries.push({
      id,
      text,
      source: typeof doc.source === "string" ? doc.source : null,
      sessionId: typeof doc.sessionId === "string" ? doc.sessionId : null,
    });
  }

  return entries.sort((a, b) => a.text.localeCompare(b.text));
}

export async function readUserMemorySnapshot(input: {
  userEmail: string;
  agentId: string;
}): Promise<UserMemorySnapshot> {
  const redis = getRedis();
  if (!redis) {
    return { globalPreferences: [], agentMemories: [] };
  }

  const scopeKey = memoryScopeKeyForEmail(input.userEmail);
  const userId = toRedisKeyPart(scopeKey);

  try {
    const [globalPreferences, agentMemories] = await Promise.all([
      readGlobalPreferences(redis, scopeKey),
      readAgentMemories(redis, input.agentId, userId),
    ]);
    return { globalPreferences, agentMemories };
  } catch (err) {
    console.warn(
      "[memory] Failed to read snapshot:",
      err instanceof Error ? err.message : err,
    );
    return { globalPreferences: [], agentMemories: [] };
  }
}
