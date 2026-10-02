import { useEffect, useRef } from "react";
import { bindChatSession } from "../lib/projects";

/** Persists Eve session → platform chat scope (generic vs project). */
export function useBindChatSession(input: {
  token: string | null;
  agentId: string;
  projectId: string | null;
  eveSessionId: string | null | undefined;
  /** Changes when starting a new conversation (bound.key). */
  conversationKey: string;
}) {
  const lastBoundSessionRef = useRef<string | null>(null);

  useEffect(() => {
    lastBoundSessionRef.current = null;
  }, [input.conversationKey]);

  useEffect(() => {
    const sid = input.eveSessionId?.trim();
    if (!sid || !input.token) return;
    if (lastBoundSessionRef.current === sid) return;
    lastBoundSessionRef.current = sid;
    void bindChatSession({
      eveSessionId: sid,
      agentId: input.agentId,
      projectId: input.projectId,
    }).catch(() => {
      lastBoundSessionRef.current = null;
    });
  }, [
    input.agentId,
    input.eveSessionId,
    input.projectId,
    input.token,
  ]);
}
