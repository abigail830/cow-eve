import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";
import {
  assertLibraryAccess,
  buildChatLibrary,
  DocRetrievalError,
  grepContent,
  loadContentMd,
} from "#platform/composition/public-api.js";
import { resolveChatIdForSession } from "../lib/resolve-chat-id.js";

export default defineTool({
  description:
    "Search parsed attachment content.md by regex or plain text. Use when attachment_id is known.",
  inputSchema: z.object({
    attachment_id: z.string().uuid(),
    pattern: z.string().min(1),
    ignore_case: z.boolean().optional().default(true),
    head_limit: z.number().int().min(1).max(50).optional().default(50),
  }),
  async execute(input, ctx) {
    const userId =
      ctx.session.auth.current?.principalId ??
      ctx.session.auth.initiator?.principalId ??
      null;
    if (!userId) return { status: "error" as const, message: "Authentication required." };

    const chatId = await resolveChatIdForSession({
      userId,
      eveSessionId: ctx.session.id,
    });
    if (!chatId) {
      return { status: "error" as const, message: "Chat not found for session." };
    }

    try {
      const library = await buildChatLibrary(chatId);
      const entry = assertLibraryAccess(library, input.attachment_id);
      const content = await loadContentMd(chatId, input.attachment_id);
      const matches = grepContent(content, input.pattern, {
        ignoreCase: input.ignore_case,
        headLimit: input.head_limit,
      });
      return {
        status: "ok" as const,
        attachment_id: input.attachment_id,
        filename: entry.filename,
        match_count: matches.length,
        matches,
      };
    } catch (err) {
      if (err instanceof DocRetrievalError) {
        return { status: "error" as const, code: err.code, message: err.message };
      }
      throw err;
    }
  },
  toModelOutput(output) {
    if (output.status === "error") {
      return toolOutput.text(output.message);
    }
    const lines = output.matches.map(
      (m) => `L${m.line}: ${m.text}`,
    );
    return toolOutput.text(
      `grep ${output.filename} (${output.match_count} matches)\n${lines.join("\n")}`,
    );
  },
});
