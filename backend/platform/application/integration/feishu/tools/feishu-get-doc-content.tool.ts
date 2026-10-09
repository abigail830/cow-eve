import { defineTool } from "eve/tools";
import { z } from "zod";
import { getDocRawContent, FeishuApiError } from "../../../../domain/integration/feishu/client.js";
import { feishuDocumentIdFromUrl } from "../../../../domain/integration/providers/feishu.js";
import {
  FEISHU_CONNECT_HINT,
  resolveFeishuAccessForSession,
} from "../resolve-feishu-access.js";

export default defineTool({
  description:
    "Read plain-text content of a Feishu docx document by document_id or docx URL.",
  inputSchema: z.object({
    document_id_or_url: z.string().min(1),
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
    const documentId =
      feishuDocumentIdFromUrl(input.document_id_or_url) ??
      input.document_id_or_url.trim();
    try {
      const payload = await getDocRawContent(access.accessToken, {
        apiBase: access.apiBase,
        documentId,
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
