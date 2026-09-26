import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";
import {
  assertLibraryAccess,
  buildChatLibrary,
  DocRetrievalError,
  loadContentMd,
  loadMetaForAttachment,
  readContentSlice,
} from "#platform/composition/public-api.js";
import { resolveChatIdForSession } from "../lib/resolve-chat-id.js";

export default defineTool({
  description:
    "Read a slice of parsed attachment content.md by line range, page, or section_id.",
  inputSchema: z.object({
    attachment_id: z.string().uuid(),
    line_start: z.number().int().optional(),
    line_end: z.number().int().optional(),
    page: z.number().int().optional(),
    section_id: z.string().optional(),
  }),
  async execute(input, ctx): Promise<
    | { status: "error"; message: string; code?: string }
    | {
        status: "ok";
        attachment_id: string;
        filename: string;
        line_start: number;
        line_end: number;
        line_count: number;
        total_lines: number;
        content: string;
        truncated: boolean;
        page: number | null;
        section_id: string | null;
      }
  > {
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
      const meta = await loadMetaForAttachment(chatId, input.attachment_id);
      const slice = readContentSlice(content, meta, {
        lineStart: input.line_start ?? null,
        lineEnd: input.line_end ?? null,
        page: input.page ?? null,
        sectionId: input.section_id ?? null,
      });
      return {
        status: "ok" as const,
        attachment_id: input.attachment_id,
        filename: entry.filename,
        line_start: Number(slice.line_start),
        line_end: Number(slice.line_end),
        line_count: Number(slice.line_count),
        total_lines: Number(slice.total_lines),
        content: String(slice.content),
        truncated: Boolean(slice.truncated),
        page: (slice.page as number | null) ?? null,
        section_id: (slice.section_id as string | null) ?? null,
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
    return toolOutput.text(
      `Read ${output.filename} lines ${output.line_start}-${output.line_end}${output.truncated ? " (truncated)" : ""}:\n${output.content}`,
    );
  },
});
