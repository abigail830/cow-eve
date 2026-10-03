import { and, eq, isNull } from "drizzle-orm";
import { listVisibleKnowledgeBases } from "../../infrastructure/integration/hybrid-search-kb.client.js";
import {
  HybridSearchKbClientError,
  type KnowledgeBaseListItem,
} from "../../infrastructure/integration/hybrid-search-kb.types.js";
import { resolveHybridSearchCredentials } from "../integration/user-integration.use-case.js";
import {
  getProjectDisabledKbIds,
  getUserAgentDisabledKbIds,
  setProjectDisabledKbIds,
  setUserAgentDisabledKbIds,
} from "../../infrastructure/persistence/kb/drizzle-kb-preference.repository.js";
import { requireDb } from "../../infrastructure/persistence/database/client.js";
import { chats } from "../../infrastructure/persistence/database/schema.js";
import { getChatSessionBinding } from "../../infrastructure/persistence/project/drizzle-project.repository.js";
import {
  enabledKbIds,
  formatKbScopeInstructionLine,
} from "./kb-scope.js";

const VISIBLE_TTL_MS = 60_000;
const visibleCache = new Map<
  string,
  { at: number; items: KnowledgeBaseListItem[] }
>();

function cacheKey(userId: string): string {
  return userId;
}

export type KnowledgeBasePublic = {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  itemCount: number | null;
  isConfigured: boolean | null;
  enabled: boolean;
};

export type KnowledgeBaseListPublic = {
  connected: boolean;
  items: KnowledgeBasePublic[];
  disabledKbIds: string[];
  message: string | null;
};

async function fetchVisibleCached(
  userId: string,
  apiKey: string,
  hybridSearchMcpUrl: string | null,
  forceRefresh = false,
): Promise<KnowledgeBaseListItem[]> {
  const key = cacheKey(userId);
  const now = Date.now();
  if (!forceRefresh) {
    const hit = visibleCache.get(key);
    if (hit && now - hit.at < VISIBLE_TTL_MS) return hit.items;
  }
  const items = await listVisibleKnowledgeBases({
    apiKey,
    hybridSearchMcpUrl,
  });
  visibleCache.set(key, { at: now, items });
  return items;
}

export function invalidateVisibleKbCache(userId?: string): void {
  if (!userId) {
    visibleCache.clear();
    return;
  }
  visibleCache.delete(cacheKey(userId));
}

async function resolveDisabledKbIds(input: {
  userId: string;
  agentId: string;
  projectId?: string | null;
}): Promise<string[]> {
  if (input.projectId?.trim()) {
    return getProjectDisabledKbIds({
      userId: input.userId,
      projectId: input.projectId.trim(),
    });
  }
  return getUserAgentDisabledKbIds({
    userId: input.userId,
    agentId: input.agentId,
  });
}

function toPublicItems(
  raw: KnowledgeBaseListItem[],
  disabled: readonly string[],
): KnowledgeBasePublic[] {
  const disabledSet = new Set(disabled);
  return raw.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    type: item.type ?? null,
    itemCount:
      typeof item.item_count === "number" ? item.item_count : null,
    isConfigured:
      typeof item.is_configured === "boolean" ? item.is_configured : null,
    enabled: !disabledSet.has(item.id),
  }));
}

export async function listKnowledgeBasesForUser(input: {
  userId: string;
  agentId: string;
  projectId?: string | null;
}): Promise<KnowledgeBaseListPublic> {
  const disabled = await resolveDisabledKbIds(input);
  const { apiKey, url: hybridSearchMcpUrl } =
    await resolveHybridSearchCredentials(input.userId);
  if (!apiKey) {
    return {
      connected: false,
      items: [],
      disabledKbIds: disabled,
      message: "Connect Hybrid Search in Integrations to list knowledge bases",
    };
  }

  try {
    const raw = await fetchVisibleCached(
      input.userId,
      apiKey,
      hybridSearchMcpUrl,
    );
    return {
      connected: true,
      items: toPublicItems(raw, disabled),
      disabledKbIds: disabled,
      message: null,
    };
  } catch (err) {
    if (err instanceof HybridSearchKbClientError) {
      const status = err.statusCode ?? 502;
      if (status === 401 || status === 403) {
        throw err;
      }
      return {
        connected: false,
        items: [],
        disabledKbIds: disabled,
        message: err.message,
      };
    }
    throw err;
  }
}

export async function getKbPreferencesForUser(input: {
  userId: string;
  agentId: string;
  projectId?: string | null;
}): Promise<{ disabledKbIds: string[] }> {
  const disabledKbIds = await resolveDisabledKbIds(input);
  return { disabledKbIds };
}

export async function setKbPreferencesForUser(input: {
  userId: string;
  agentId: string;
  projectId?: string | null;
  disabledKbIds: readonly string[];
}): Promise<{ disabledKbIds: string[] }> {
  if (input.projectId?.trim()) {
    const disabledKbIds = await setProjectDisabledKbIds({
      userId: input.userId,
      projectId: input.projectId.trim(),
      disabledKbIds: input.disabledKbIds,
    });
    return { disabledKbIds };
  }
  const disabledKbIds = await setUserAgentDisabledKbIds({
    userId: input.userId,
    agentId: input.agentId,
    disabledKbIds: input.disabledKbIds,
  });
  return { disabledKbIds };
}

async function resolveProjectIdForChat(input: {
  userId: string;
  chatId: string;
  eveSessionId?: string | null;
}): Promise<string | null> {
  const db = requireDb();
  const chat = await db.query.chats.findFirst({
    where: and(
      eq(chats.id, input.chatId),
      eq(chats.userId, input.userId),
      isNull(chats.deletedAt),
    ),
    columns: { projectId: true },
  });
  if (chat?.projectId) return chat.projectId;
  if (input.eveSessionId) {
    const binding = await getChatSessionBinding(input.eveSessionId);
    return binding?.projectId ?? null;
  }
  return null;
}

/** Turn instruction body when some KBs are disabled; null when all visible KBs are allowed. */
export async function getKbScopeInstructionForChat(input: {
  userId: string;
  agentId: string;
  chatId: string;
  eveSessionId?: string | null;
}): Promise<string | null> {
  const projectId = await resolveProjectIdForChat({
    userId: input.userId,
    chatId: input.chatId,
    eveSessionId: input.eveSessionId,
  });

  const disabled = await resolveDisabledKbIds({
    userId: input.userId,
    agentId: input.agentId,
    projectId,
  });
  if (disabled.length === 0) return null;

  const { apiKey, url: hybridSearchMcpUrl } =
    await resolveHybridSearchCredentials(input.userId);
  if (!apiKey) return null;

  let raw: KnowledgeBaseListItem[];
  try {
    raw = await fetchVisibleCached(
      input.userId,
      apiKey,
      hybridSearchMcpUrl,
    );
  } catch {
    return null;
  }

  const visibleIds = raw.map((item) => item.id);
  const allowed = enabledKbIds({ visibleIds, disabledIds: disabled });
  const allowedSet = new Set(allowed);
  const enabledItems = raw
    .filter((item) => allowedSet.has(item.id))
    .map((item) => ({ id: item.id, name: item.name }));

  return formatKbScopeInstructionLine(enabledItems);
}
