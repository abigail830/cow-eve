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

function assistantAfterUser(
  messages: readonly EveMessage[],
  userIndex: number,
): { index: number; message: EveMessage } | null {
  let j = userIndex + 1;
  while (j < messages.length && isClientContextOnlyMessage(messages[j]!)) j += 1;
  if (j < messages.length && messages[j]!.role === "assistant") {
    return { index: j, message: messages[j]! };
  }
  return null;
}

/**
 * Eve inserts a steer user message in front of the in-progress assistant row
 * (same turn). That only happens when an earlier user message exists and no
 * assistant row sits between them.
 */
function steerUserInsertedBeforeAssistant(
  messages: readonly EveMessage[],
  userIndex: number,
): { index: number; message: EveMessage } | null {
  const following = assistantAfterUser(messages, userIndex);
  if (!following) return null;
  let earlierUser = false;
  for (let k = 0; k < userIndex; k += 1) {
    const row = messages[k]!;
    if (row.role === "assistant") return null;
    if (row.role === "user" && !isClientContextOnlyMessage(row)) earlierUser = true;
  }
  return earlierUser ? following : null;
}

function isOpenDynamicTool(part: EveMessage["parts"][number]): boolean {
  if (part.type !== "dynamic-tool" || !("state" in part)) return false;
  const state = String(part.state);
  return (
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-requested"
  );
}

/** Split after the first unanswered ask_question so later parts stay with the steer. */
function pendingAskQuestionSplit(message: EveMessage): number | null {
  const index = message.parts.findIndex(
    (part) =>
      part.type === "dynamic-tool" &&
      "toolName" in part &&
      part.toolName === "ask_question" &&
      isOpenDynamicTool(part),
  );
  if (index < 0) return null;
  return index + 1;
}

function resolveSplitAt(
  assistant: EveMessage,
  recorded: ReadonlyMap<string, number>,
): number | null {
  const inferred = pendingAskQuestionSplit(assistant);
  if (inferred != null && inferred > 0 && inferred <= assistant.parts.length) {
    return inferred;
  }
  const saved = recorded.get(assistant.id);
  if (saved != null && saved > 0 && saved <= assistant.parts.length) return saved;
  return null;
}

type SteerPlacement = "head" | "tail";

const steerPlacementByMessage = new WeakMap<EveMessage, SteerPlacement>();

export function steerPlacement(
  message: EveMessage,
): SteerPlacement | undefined {
  return steerPlacementByMessage.get(message);
}

function tagSteerPlacement(
  message: EveMessage,
  placement: SteerPlacement,
): EveMessage {
  steerPlacementByMessage.set(message, placement);
  return message;
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
    if (linked && !updates.has(linked.message.id)) {
      const prevAssistant = prev.find((m) => m.id === linked.message.id);
      const splitAt =
        prevAssistant?.parts.length ?? linked.message.parts.length;
      updates.set(linked.message.id, splitAt);
      continue;
    }

    const insertedBefore = steerUserInsertedBeforeAssistant(next, i);
    if (!insertedBefore || updates.has(insertedBefore.message.id)) continue;
    const prevAssistant = prev.find((m) => m.id === insertedBefore.message.id);
    if (prevAssistant && prevAssistant.parts.length > 0) {
      updates.set(insertedBefore.message.id, prevAssistant.parts.length);
    }
  }

  return updates;
}

/**
 * Eve keeps one assistant row for the whole turn. A steer either appends parts
 * after the user message, or inserts that user message in front of the assistant
 * row. Display order is always: assistant head → user → assistant tail.
 */
export function expandSteeredAssistantMessages(
  messages: readonly EveMessage[],
  splitAfterParts: ReadonlyMap<string, number>,
): EveMessage[] {
  const out: EveMessage[] = [];
  const scheduled = new Map<string, { splitAt: number; userId: string }>();

  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i]!;

    if (msg.role === "user" && !isClientContextOnlyMessage(msg)) {
      const insertedBefore = steerUserInsertedBeforeAssistant(messages, i);
      if (insertedBefore && !scheduled.has(insertedBefore.message.id)) {
        const splitAt = resolveSplitAt(insertedBefore.message, splitAfterParts);
        if (splitAt != null) {
          scheduled.set(insertedBefore.message.id, {
            splitAt,
            userId: msg.id,
          });
          out.push(
            tagSteerPlacement(
              { ...insertedBefore.message, parts: insertedBefore.message.parts.slice(0, splitAt) },
              "head",
            ),
          );
        }
      }
    }

    if (msg.role === "assistant") {
      const plan = scheduled.get(msg.id);
      if (plan) {
        if (plan.splitAt < msg.parts.length) {
          out.push(
            tagSteerPlacement(
              {
                ...msg,
                id: `${msg.id}:steer:${plan.userId}`,
                parts: msg.parts.slice(plan.splitAt),
              },
              "tail",
            ),
          );
        }
        continue;
      }

      const userIdx = nextSteerUserIndex(messages, i);
      const splitAt = userIdx != null ? splitAfterParts.get(msg.id) : undefined;
      if (splitAt != null && splitAt > 0 && splitAt < msg.parts.length) {
        out.push(
          tagSteerPlacement(
            { ...msg, parts: msg.parts.slice(0, splitAt) },
            "head",
          ),
        );
        continue;
      }
    }

    out.push(msg);

    if (msg.role === "user" && !isClientContextOnlyMessage(msg)) {
      const linked = assistantBeforeUser(messages, i);
      if (!linked || scheduled.has(linked.message.id)) continue;
      const splitAt = splitAfterParts.get(linked.message.id);
      if (splitAt == null || splitAt >= linked.message.parts.length) continue;
      out.push(
        tagSteerPlacement(
          {
            ...linked.message,
            id: `${linked.message.id}:steer:${msg.id}`,
            parts: linked.message.parts.slice(splitAt),
          },
          "tail",
        ),
      );
    }
  }

  return out;
}

/** Open tool calls that belong to the reply from before the steer message. */
export function supersededToolCallIds(
  messages: readonly EveMessage[],
  splitAfterParts: ReadonlyMap<string, number>,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const message of expandSteeredAssistantMessages(messages, splitAfterParts)) {
    if (steerPlacement(message) !== "head") continue;
    for (const part of message.parts) {
      if (
        part.type === "dynamic-tool" &&
        isOpenDynamicTool(part) &&
        "toolCallId" in part &&
        part.toolCallId
      ) {
        ids.add(String(part.toolCallId));
      }
    }
  }
  return ids;
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
