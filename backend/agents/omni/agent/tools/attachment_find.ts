import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";
import {
  buildChatLibrary,
  findAttachments,
} from "#platform/composition/public-api.js";
import { resolveChatIdForSession } from "../lib/resolve-chat-id.js";

export default defineTool({
  description:
    "Find chat attachments by fuzzy filename or keywords when attachment_id is unknown.",
  inputSchema: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(10).optional().default(5),
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

    const library = await buildChatLibrary(chatId);
    const candidates = findAttachments(library, input.query, input.limit);
    return { status: "ok" as const, query: input.query, candidates };
  },
  toModelOutput(output) {
    if (output.status === "error") return toolOutput.text(output.message);
    if (output.candidates.length === 0) {
      return toolOutput.text(`No attachments matched "${output.query}".`);
    }
    const lines = output.candidates.map(
      (c) =>
        `- ${c.filename} (attachment_id=${c.attachment_id}, score=${c.score})`,
    );
    return toolOutput.text(`Candidates for "${output.query}":\n${lines.join("\n")}`);
  },
});
