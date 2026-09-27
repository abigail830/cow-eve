import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import { fetchChat } from "./api";
import { resolveHistorySession } from "./chat-stream";

export type BoundSession = {
  chatId: string | null;
  session: ClientSessionState | undefined;
  events: readonly MessageStreamEvent[] | undefined;
  resume: boolean;
  key: string;
};

/** Load conversation from DB — no client-side cache. */
export async function fetchBoundSession(chatId: string): Promise<BoundSession> {
  const res = await fetchChat(chatId);
  const events = res.chat.events as MessageStreamEvent[];
  const history = resolveHistorySession({
    eveSessionId: res.chat.eveSessionId,
    streamIndex: res.chat.streamIndex,
    events,
  });
  return {
    chatId,
    session: history.session,
    events: history.events,
    resume: history.resume,
    key: `chat-${chatId}`,
  };
}
