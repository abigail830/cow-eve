import { defineHook } from "eve/hooks";
import {
  linkScheduleRunChat,
  persistStreamEvent,
} from "#platform/composition/public-api.js";

function readScheduleId(
  attributes: Record<string, string | readonly string[]> | undefined,
): string | null {
  const value = attributes?.scheduleId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default defineHook({
  events: {
    async "*"(event, ctx) {
      try {
        const auth = ctx.session.auth.current ?? ctx.session.auth.initiator;
        const userId = auth?.principalId ?? null;
        await persistStreamEvent({
          userId,
          agentId: ctx.agent.name,
          eveSessionId: ctx.session.id,
          event,
        });
        const scheduleId = readScheduleId(auth?.attributes);
        if (scheduleId && userId) {
          await linkScheduleRunChat({
            scheduleId,
            userId,
            eveSessionId: ctx.session.id,
          });
        }
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
