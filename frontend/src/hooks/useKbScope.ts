import { useCallback, useEffect, useRef, useState } from "react";
import {
  listAgentKnowledgeBases,
  putAgentKbPreferences,
  type KnowledgeBaseItem,
} from "../lib/knowledgeBases";

type KbListCacheEntry = {
  at: number;
  connected: boolean;
  message: string | null;
  items: KnowledgeBaseItem[];
};

const KB_LIST_CACHE_TTL_MS = 60_000;
const PERSIST_DEBOUNCE_MS = 280;
const kbListCache = new Map<string, KbListCacheEntry>();

function scopeCacheKey(agentId: string, projectId: string | null | undefined): string {
  return `${agentId}:${projectId?.trim() || "global"}`;
}

export function useKbScope(input: {
  agentId: string;
  projectId?: string | null;
  /** When false, skip initial load (e.g. hidden tab). */
  active?: boolean;
}) {
  const { agentId, projectId, active = true } = input;
  const cacheKey = scopeCacheKey(agentId, projectId);
  const persistTimerRef = useRef<number | null>(null);
  const persistSeqRef = useRef(0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);

  const applyCacheEntry = useCallback((entry: KbListCacheEntry) => {
    setConnected(entry.connected);
    setMessage(entry.message);
    setItems(entry.items);
  }, []);

  const load = useCallback(
    async (opts?: { force?: boolean; silent?: boolean }) => {
      const cached = kbListCache.get(cacheKey);
      const cacheFresh =
        cached != null && Date.now() - cached.at < KB_LIST_CACHE_TTL_MS;

      if (cached && !opts?.force) {
        applyCacheEntry(cached);
        if (cacheFresh) {
          setLoading(false);
          return;
        }
      }

      if (!opts?.silent && !cached) {
        setLoading(true);
      }
      setError(null);
      try {
        const result = await listAgentKnowledgeBases(agentId, projectId);
        const entry: KbListCacheEntry = {
          at: Date.now(),
          connected: result.connected,
          message: result.message,
          items: result.items,
        };
        kbListCache.set(cacheKey, entry);
        applyCacheEntry(entry);
      } catch (err) {
        setConnected(false);
        setItems([]);
        setError(
          err instanceof Error ? err.message : "Failed to load knowledge bases",
        );
      } finally {
        setLoading(false);
      }
    },
    [agentId, projectId, cacheKey, applyCacheEntry],
  );

  useEffect(() => {
    setItems([]);
    setConnected(false);
    setMessage(null);
    if (active) void load({ silent: true });
  }, [cacheKey, active, load]);

  useEffect(
    () => () => {
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current);
      }
    },
    [],
  );

  const flushPersist = useCallback(
    async (nextItems: KnowledgeBaseItem[]) => {
      const seq = ++persistSeqRef.current;
      setSaving(true);
      setError(null);
      const disabledIds = nextItems
        .filter((item) => !item.enabled)
        .map((item) => item.id);
      try {
        await putAgentKbPreferences(agentId, disabledIds, projectId);
        if (seq !== persistSeqRef.current) return;
        const cached = kbListCache.get(cacheKey);
        if (cached) {
          kbListCache.set(cacheKey, {
            ...cached,
            at: Date.now(),
            items: nextItems,
          });
        }
      } catch (err) {
        if (seq !== persistSeqRef.current) return;
        setError(
          err instanceof Error ? err.message : "Failed to save preference",
        );
        await load({ force: true });
      } finally {
        if (seq === persistSeqRef.current) {
          setSaving(false);
        }
      }
    },
    [agentId, projectId, cacheKey, load],
  );

  const schedulePersist = useCallback(
    (nextItems: KnowledgeBaseItem[], options?: { immediate?: boolean }) => {
      setItems(nextItems);
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (options?.immediate) {
        void flushPersist(nextItems);
        return;
      }
      persistTimerRef.current = window.setTimeout(() => {
        persistTimerRef.current = null;
        void flushPersist(nextItems);
      }, PERSIST_DEBOUNCE_MS);
    },
    [flushPersist],
  );

  const toggleOne = useCallback(
    (id: string, enabled: boolean) => {
      const next = items.map((item) =>
        item.id === id ? { ...item, enabled } : item,
      );
      schedulePersist(next);
    },
    [items, schedulePersist],
  );

  const setAll = useCallback(
    (enabled: boolean) => {
      schedulePersist(
        items.map((item) => ({ ...item, enabled })),
        { immediate: true },
      );
    },
    [items, schedulePersist],
  );

  const enabledCount = items.filter((item) => item.enabled).length;
  const scopeActive =
    items.length > 0 && enabledCount < items.length;

  return {
    loading,
    saving,
    error,
    connected,
    message,
    items,
    enabledCount,
    scopeActive,
    load,
    toggleOne,
    setAll,
  };
}
