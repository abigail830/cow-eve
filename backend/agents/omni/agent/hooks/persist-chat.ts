import { defineHook } from "eve/hooks";
import { persistStreamEvent } from "#platform/chat/persist.js";


export default defineHook({
  events: {
    async "*"(event, ctx) {
      try {
        const userId =
          ctx.session.auth.current?.principalId ??
          ctx.session.auth.initiator?.principalId ??
          null;
        await persistStreamEvent({
          userId,
          agentId: ctx.agent.name,
          eveSessionId: ctx.session.id,
          event,
        });
      } catch (err) {
        console.error("[persist-chat] failed", {
          type: event.type,
          sessionId: ctx.session.id,
          error: err instanceof Error ? err.message : err,
        });
      }
    },
  },
});
