import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";
import { buildChatLibrary } from "#platform/composition/public-api.js";
import { resolveChatIdForSession } from "../lib/resolve-chat-id.js";

export default defineTool({
  description: "List parse-ready attachments in this chat (compact catalog).",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
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

    const library = await buildChatLibrary(chatId);
    const attachments = [...library.values()].map((entry) => ({
      attachment_id: entry.attachmentId,
      filename: entry.filename,
      kind: entry.kind,
      parse_status: entry.parseStatus,
      page_count: entry.pageCount,
      line_count: entry.lineCount,
    }));
    return { status: "ok" as const, count: attachments.length, attachments };
  },
  toModelOutput(output) {
    if (output.status === "error") return toolOutput.text(output.message);
    if (output.count === 0) {
      return toolOutput.text("No parse-ready attachments in this chat.");
    }
    const lines = output.attachments.map(
      (a) =>
        `- ${a.filename} (attachment_id=${a.attachment_id}, ${a.kind}, ${a.parse_status})`,
    );
    return toolOutput.text(`Chat attachments (${output.count}):\n${lines.join("\n")}`);
  },
});
