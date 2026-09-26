import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";
import {
  assertLibraryAccess,
  buildChatLibrary,
  DocRetrievalError,
  loadMetaForAttachment,
  readFigurePayload,
} from "#platform/composition/public-api.js";
import { resolveChatIdForSession } from "../lib/resolve-chat-id.js";

export default defineTool({
  description:
    "Load a mirrored document figure (figure:fN) as vision input after attachment_read shows placeholders.",
  inputSchema: z.object({
    attachment_id: z.string().uuid(),
    figure_id: z.string().min(1),
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
      const meta = await loadMetaForAttachment(chatId, input.attachment_id);
      const payload = await readFigurePayload({
        chatId,
        attachmentId: input.attachment_id,
        figureId: input.figure_id,
        meta,
      });
      return {
        status: "ok" as const,
        attachment_id: input.attachment_id,
        filename: entry.filename,
        ...payload,
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
    return toolOutput.content([
      toolOutputPart.text(
        `Figure ${output.figure_id} from ${output.filename}${output.alt ? `: ${output.alt}` : ""}`,
      ),
      toolOutputPart.file(output.image_base64, {
        mediaType: output.mime_type,
        filename: `${output.figure_id}.${output.mime_type.split("/")[1] ?? "jpeg"}`,
      }),
    ]);
  },
});
