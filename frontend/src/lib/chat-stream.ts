import type { ClientSessionState, MessageStreamEvent } from "eve/client";

const SESSION_IDLE_TAIL = new Set([
  "session.waiting",
  "session.completed",
  "session.failed",
]);

/** Idle tail — reconnect when the persisted stream is not at session rest. */
export function historyNeedsResume(
  events: readonly MessageStreamEvent[],
): boolean {
  if (events.length === 0) return false;
  const last = events[events.length - 1];
  if (SESSION_IDLE_TAIL.has(last.type)) return false;
  // Turn ended without a session idle tail (older persisted rows).
  if (last.type === "turn.failed" || last.type === "turn.cancelled") {
    return false;
  }
  return true;
}

export function resolveHistorySession(input: {
  eveSessionId: string;
  streamIndex: number;
  events: readonly MessageStreamEvent[];
}): {
  session: ClientSessionState;
  events: readonly MessageStreamEvent[];
  resume: boolean;
} {
  const eventCount = input.events.length;
  const streamIndex =
    input.streamIndex === eventCount ? input.streamIndex : eventCount;

  return {
    session: { sessionId: input.eveSessionId, streamIndex },
    events: input.events,
    resume: historyNeedsResume(input.events),
  };
}
