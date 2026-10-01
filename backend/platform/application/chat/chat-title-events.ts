import type { ChatEvent } from "../../domain/chat/chat.entity.js";
import { PLATFORM_PRODUCT_MESSAGE_KIND } from "../../domain/chat/platform-product-turn.types.js";

const CLIENT_CONTEXT_MARKER = "Client context:";

function payloadData(event: ChatEvent): Record<string, unknown> | null {
  if (!event.payload || typeof event.payload !== "object") return null;
  const root = event.payload as { data?: unknown };
  if (!root.data || typeof root.data !== "object") return null;
  return root.data as Record<string, unknown>;
}

function readStringField(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function userVisibleText(message: string): string {
  const idx = message.indexOf(CLIENT_CONTEXT_MARKER);
  const head = idx >= 0 ? message.slice(0, idx) : message;
  return head.replace(/\s+/g, " ").trim();
}

function isUserMessageEvent(event: ChatEvent): boolean {
  if (event.type !== "message.received") return false;
  const data = payloadData(event);
  if (!data) return false;
  if (data.kind === "execution.background_task") return false;
  if (data.kind === PLATFORM_PRODUCT_MESSAGE_KIND) return false;
  const message = readStringField(data, ["message"]);
  return Boolean(userVisibleText(message));
}

export function countUserTurnMessages(events: readonly ChatEvent[]): number {
  return events.filter(isUserMessageEvent).length;
}

export function extractUserMessageTexts(
  events: readonly ChatEvent[],
  maxMessages: number,
  maxCharsPerMessage: number,
): string[] {
  const out: string[] = [];
  for (const event of events) {
    if (!isUserMessageEvent(event)) continue;
    const data = payloadData(event);
    if (!data) continue;
    const message = userVisibleText(readStringField(data, ["message"]));
    if (!message) continue;
    out.push(
      message.length <= maxCharsPerMessage
        ? message
        : `${message.slice(0, maxCharsPerMessage)}…`,
    );
    if (out.length >= maxMessages) break;
  }
  return out;
}

export function extractLastAssistantText(
  events: readonly ChatEvent[],
  maxChars: number,
): string {
  let appendedByTurn = new Map<string, string>();
  let lastCompleted = "";

  for (const event of events) {
    const data = payloadData(event);
    if (!data) continue;
    const turnId =
      typeof data.turnId === "string" && data.turnId.length > 0
        ? data.turnId
        : null;

    if (event.type === "message.appended") {
      const delta = readStringField(data, ["delta", "message", "content", "text"]);
      if (!delta || !turnId) continue;
      appendedByTurn.set(turnId, (appendedByTurn.get(turnId) ?? "") + delta);
      continue;
    }

    if (event.type === "message.completed") {
      const direct = readStringField(data, ["message", "content", "text"]);
      if (direct) {
        lastCompleted = direct;
        continue;
      }
      if (turnId && appendedByTurn.has(turnId)) {
        lastCompleted = appendedByTurn.get(turnId) ?? "";
      }
    }
  }

  const text = lastCompleted.replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`;
}
