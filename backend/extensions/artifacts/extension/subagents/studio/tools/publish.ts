import { defineTool } from "eve/tools";
import { z } from "zod";
import { publishSandboxArtifact } from "../../../../../../platform/composition/public-api.js";

export default defineTool({
  description:
    "Publish a final deliverable from the sandbox to the chat UI as a downloadable artifact. " +
    "Call after the file is fully written (docx, pptx, html). " +
    "Do not publish intermediate scratch files unless the user asked.",
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "Absolute sandbox path to the final file, e.g. /workspace/content-studio/report.docx.",
      ),
    title: z.string().describe("Short title for the download card.").default(""),
  }),
  async execute({ path, title }, ctx) {
    const userId =
      ctx.session.auth.current?.principalId ??
      ctx.session.auth.initiator?.principalId ??
      null;
    if (!userId) {
      return {
        status: "error",
        message: "Authentication required to publish artifacts.",
      };
    }

    let fileBytes: Uint8Array;
    try {
      const sandbox = await ctx.getSandbox();
      const bytes = await sandbox.readBinaryFile({ path });
      if (!bytes?.byteLength) {
        return { status: "error", message: "Deliverable file is empty or missing." };
      }
      fileBytes = bytes;
    } catch (err) {
      return {
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to read deliverable from sandbox.",
      };
    }

    if (!fileBytes.byteLength) {
      return { status: "error", message: "Deliverable file is empty." };
    }

    const result = await publishSandboxArtifact({
      userId,
      eveSessionId: ctx.session.id,
      sandboxPath: path,
      fileBytes,
      title,
    });

    if (!result.spec) {
      return {
        status: "error",
        message: result.error ?? "Failed to persist artifact.",
      };
    }

    return {
      status: "queued",
      queued: true,
      ...result.spec,
    };
  },
});
