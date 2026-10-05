import { useEffect, useRef, useState } from "react";
import type { EveMessage } from "eve/react";
import { isClientContextOnlyMessage } from "./userMessageAttachments";

function assistantBeforeUser(
  messages: readonly EveMessage[],
  userIndex: number,
): { index: number; message: EveMessage } | null {
  let j = userIndex - 1;
  while (j >= 0 && isClientContextOnlyMessage(messages[j]!)) j -= 1;
  if (j >= 0 && messages[j]!.role === "assistant") {
    return { index: j, message: messages[j]! };
  }
  return null;
}

function nextSteerUserIndex(
  messages: readonly EveMessage[],
  assistantIndex: number,
): number | null {
  for (let j = assistantIndex + 1; j < messages.length; j += 1) {
    const row = messages[j]!;
    if (row.role === "assistant") return null;
    if (row.role === "user" && !isClientContextOnlyMessage(row)) return j;
  }
  return null;
}

/** Record assistant part counts when a steer user message is inserted mid-turn. */
export function computeSteerSplitUpdates(
  prev: readonly EveMessage[],
  next: readonly EveMessage[],
  existing: ReadonlyMap<string, number>,
): Map<string, number> {
  const prevIds = new Set(prev.map((m) => m.id));
  const updates = new Map(existing);

  for (let i = 0; i < next.length; i += 1) {
    const msg = next[i]!;
    if (msg.role !== "user" || isClientContextOnlyMessage(msg)) continue;
    if (prevIds.has(msg.id)) continue;

    const linked = assistantBeforeUser(next, i);
    if (!linked || updates.has(linked.message.id)) continue;

    const prevAssistant = prev.find((m) => m.id === linked.message.id);
    const splitAt =
      prevAssistant?.parts.length ?? linked.message.parts.length;
    updates.set(linked.message.id, splitAt);
  }

  return updates;
}

/**
 * Eve steer keeps appending tool parts to the pre-steer assistant row while inserting
 * the user message after it. Split for display: assistant (head) → user → assistant (tail).
 */
export function expandSteeredAssistantMessages(
  messages: readonly EveMessage[],
  splitAfterParts: ReadonlyMap<string, number>,
): EveMessage[] {
  if (splitAfterParts.size === 0) return [...messages];

  const out: EveMessage[] = [];

  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i]!;

    if (msg.role === "assistant") {
      const userIdx = nextSteerUserIndex(messages, i);
      const splitAt =
        userIdx != null ? splitAfterParts.get(msg.id) : undefined;
      if (
        splitAt != null &&
        splitAt > 0 &&
        splitAt < msg.parts.length
      ) {
        out.push({ ...msg, parts: msg.parts.slice(0, splitAt) });
        continue;
      }
    }

    out.push(msg);

    if (msg.role === "user" && !isClientContextOnlyMessage(msg)) {
      const linked = assistantBeforeUser(messages, i);
      if (!linked) continue;
      const splitAt = splitAfterParts.get(linked.message.id);
      if (splitAt == null || splitAt >= linked.message.parts.length) continue;
      out.push({
        ...linked.message,
        id: `${linked.message.id}:steer:${msg.id}`,
        parts: linked.message.parts.slice(splitAt),
      });
    }
  }

  return out;
}

export function useSteerAssistantSplitMap(
  messages: readonly EveMessage[],
): ReadonlyMap<string, number> {
  const prevRef = useRef<readonly EveMessage[]>(messages);
  const splitsRef = useRef<Map<string, number>>(new Map());
  const [, bump] = useState(0);

  useEffect(() => {
    const prev = prevRef.current;
    const updates = computeSteerSplitUpdates(
      prev,
      messages,
      splitsRef.current,
    );
    prevRef.current = messages;
    if (updates.size !== splitsRef.current.size) {
      splitsRef.current = updates;
      bump((n) => n + 1);
      return;
    }
    for (const [key, value] of updates) {
      if (splitsRef.current.get(key) !== value) {
        splitsRef.current = updates;
        bump((n) => n + 1);
        return;
      }
    }
  }, [messages]);

  return splitsRef.current;
}
