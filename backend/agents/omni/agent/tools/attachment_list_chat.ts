import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";
import { listSessionDocumentsForAgent } from "#platform/composition/public-api.js";
import { collectSessionDocumentIds } from "../lib/session-document-ids.js";
import { resolveChatIdForSession } from "../lib/resolve-chat-id.js";

export default defineTool({
  description:
    "List documents available in this chat: chat attachments and imported workspace files (pending or ready). Use attachment_id (UUID or ws:<uuid>) with read/grep when parse_status is ready.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const userId =
      ctx.session.auth.current?.principalId ??
      ctx.session.auth.initiator?.principalId ??
      null;
    if (!userId) {
      return { status: "error" as const, message: "Authentication required." };
    }

    const chatId = await resolveChatIdForSession({
      userId,
      eveSessionId: ctx.session.id,
    });
    if (!chatId) {
      return { status: "error" as const, message: "Chat not found for session." };
    }

    const { workspaceFileIds } = await collectSessionDocumentIds({
      ctx,
      userId,
      chatId,
    });
    const attachments = await listSessionDocumentsForAgent({
      userId,
      eveSessionId: ctx.session.id,
      workspaceFileIds,
    });

    return { status: "ok" as const, count: attachments.length, attachments };
  },
  toModelOutput(output) {
    if (output.status === "error") return toolOutput.text(output.message);
    if (output.count === 0) {
      return toolOutput.text("No documents in this chat session.");
    }
    const lines = output.attachments.map(
      (a) =>
        `- ${a.filename} (attachment_id=${a.attachment_id}, source=${a.source}, parse_status=${a.parse_status})`,
    );
    return toolOutput.text(
      `Session documents (${output.count}):\n${lines.join("\n")}`,
    );
  },
});
