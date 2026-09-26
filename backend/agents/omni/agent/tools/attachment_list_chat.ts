import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";
import {
  classifyAttachment,
  listChatAttachmentsForSession,
} from "#platform/composition/public-api.js";

export default defineTool({
  description:
    "List attachments in this chat (including pending parse). Use attachment_id with read/grep tools when parse_status is ready.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const userId =
      ctx.session.auth.current?.principalId ??
      ctx.session.auth.initiator?.principalId ??
      null;
    if (!userId) {
      return { status: "error" as const, message: "Authentication required." };
    }

    const rows = await listChatAttachmentsForSession({
      userId,
      eveSessionId: ctx.session.id,
    });

    const attachments = rows.map((row) => {
      let kind = "file";
      try {
        kind = classifyAttachment({
          filename: row.filename,
          mimeType: row.mediaType,
        });
      } catch {
        /* keep default */
      }
      return {
        attachment_id: row.id,
        filename: row.filename,
        kind,
        parse_status: row.parseStatus,
        size_bytes: row.sizeBytes,
      };
    });

    return { status: "ok" as const, count: attachments.length, attachments };
  },
  toModelOutput(output) {
    if (output.status === "error") return toolOutput.text(output.message);
    if (output.count === 0) {
      return toolOutput.text("No attachments in this chat.");
    }
    const lines = output.attachments.map(
      (a) =>
        `- ${a.filename} (attachment_id=${a.attachment_id}, ${a.kind}, parse_status=${a.parse_status})`,
    );
    return toolOutput.text(`Chat attachments (${output.count}):\n${lines.join("\n")}`);
  },
});
