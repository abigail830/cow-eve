import { defineDynamic } from "eve";
import { defineInstructions } from "eve/instructions";
import { getKbScopeInstructionForChat } from "#platform/composition/public-api.js";
import { resolveChatIdForSession } from "../lib/resolve-chat-id.js";

export default defineDynamic({
  events: {
    async "turn.started"(_event, ctx) {
      const userId =
        ctx.session.auth.current?.principalId ??
        ctx.session.auth.initiator?.principalId ??
        null;
      if (!userId) return null;

      const chatId = await resolveChatIdForSession({
        userId,
        eveSessionId: ctx.session.id,
      });
      if (!chatId) return null;

      const line = await getKbScopeInstructionForChat({
        userId,
        agentId: "nova-auditor",
        chatId,
        eveSessionId: ctx.session.id,
      });
      if (!line?.trim()) return null;

      return defineInstructions({
        role: "user",
        content: line.trim(),
      });
    },
  },
});
