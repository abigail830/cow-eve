import { defineTool } from "eve/tools";
import { z } from "zod";
import { listMessages, FeishuApiError } from "../../../../domain/integration/feishu/client.js";
import {
  FEISHU_CONNECT_HINT,
  resolveFeishuAccessForSession,
} from "../resolve-feishu-access.js";

export default defineTool({
  description:
    "List recent messages in a Feishu chat. Use feishu_list_chats to discover chat_id.",
  inputSchema: z.object({
    chat_id: z.string().min(1),
    page_size: z.number().int().min(1).max(50).optional().default(20),
  }),
  async execute(input, ctx) {
    const userId =
      ctx.session.auth.current?.principalId ??
      ctx.session.auth.initiator?.principalId ??
      null;
    if (!userId) return { status: "error" as const, code: "auth", message: "Authentication required." };
    const access = await resolveFeishuAccessForSession({
      userId,
      eveSessionId: ctx.session.id,
    });
    if (!access) {
      return { status: "error" as const, code: "not_connected", message: FEISHU_CONNECT_HINT };
    }
    try {
      const messages = await listMessages(access.accessToken, {
        apiBase: access.apiBase,
        chatId: input.chat_id,
        pageSize: input.page_size,
      });
      return {
        status: "ok" as const,
        chat_id: input.chat_id.trim(),
        count: messages.length,
        messages,
      };
    } catch (err) {
      if (err instanceof FeishuApiError) {
        return { status: "error" as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});
