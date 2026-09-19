import type { ClientSessionState, MessageStreamEvent } from "eve/client";

const DELTA_EVENT_TYPES = new Set([
  "message.appended",
  "reasoning.appended",
  "action.partial",
  "action.input_appended",
]);

/** Chats persisted before full-stream storage (summary events only, no deltas). */
export function isLegacyPartialStream(
  events: readonly MessageStreamEvent[],
): boolean {
  if (events.length === 0) return false;
  if (events.some((event) => DELTA_EVENT_TYPES.has(event.type))) return false;
  return events.some(
    (event) =>
      event.type === "message.completed" ||
      event.type === "turn.completed" ||
      event.type === "session.waiting",
  );
}

export function resolveHistorySession(input: {
  eveSessionId: string;
  streamIndex: number;
  events: readonly MessageStreamEvent[];
}): {
  session: ClientSessionState;
  events: readonly MessageStreamEvent[] | undefined;
  resume: boolean;
} {
  if (isLegacyPartialStream(input.events)) {
    return {
      session: { sessionId: input.eveSessionId, streamIndex: 0 },
      events: undefined,
      resume: true,
    };
  }

  const eventCount = input.events.length;
  const streamIndex =
    input.streamIndex === eventCount ? input.streamIndex : eventCount;

  return {
    session: { sessionId: input.eveSessionId, streamIndex },
    events: input.events,
    resume: true,
  };
}
