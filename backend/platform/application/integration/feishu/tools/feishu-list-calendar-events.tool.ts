import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  listCalendarEvents,
  FeishuApiError,
} from "../../../../domain/integration/feishu/client.js";
import {
  FEISHU_CONNECT_HINT,
  resolveFeishuAccessForSession,
} from "../resolve-feishu-access.js";

export default defineTool({
  description:
    "List upcoming events from the connected user's primary Feishu calendar.",
  inputSchema: z.object({
    days_ahead: z.number().int().min(1).max(30).optional().default(7),
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
      const payload = await listCalendarEvents(access.accessToken, {
        apiBase: access.apiBase,
        daysAhead: input.days_ahead,
        pageSize: input.page_size,
      });
      return { status: "ok" as const, ...payload };
    } catch (err) {
      if (err instanceof FeishuApiError) {
        return { status: "error" as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
});
