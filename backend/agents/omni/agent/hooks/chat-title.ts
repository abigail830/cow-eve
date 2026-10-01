import { defineHook } from "eve/hooks";
import { scheduleChatTitleOnce } from "#platform/composition/public-api.js";
import { resolveChatIdForSession } from "../lib/resolve-chat-id.js";

export default defineHook({
  events: {
    async "turn.completed"(_event, ctx) {
      const auth = ctx.session.auth.current ?? ctx.session.auth.initiator;
      const userId = auth?.principalId;
      if (!userId) return;

      const chatId = await resolveChatIdForSession({
        userId,
        eveSessionId: ctx.session.id,
      });
      if (!chatId) return;

      scheduleChatTitleOnce(chatId);
    },
  },
});
