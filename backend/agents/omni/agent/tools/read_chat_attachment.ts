import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";
import { readChatAttachmentForSession } from "#platform/composition/public-api.js";
import {
  candidateAttachmentSandboxPaths,
  eveStagedAttachmentPath,
} from "../lib/attachment-sandbox-paths.js";

const IMAGE_INLINE_MAX_BYTES = 3 * 1024 * 1024;
const PDF_INLINE_MAX_BYTES = 20 * 1024 * 1024;

const TEXT_INLINE_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

export type ReadChatAttachmentToolOutput =
  | {
      status: "ok";
      message: string;
      filename: string;
      mediaType: string;
      sizeBytes: number;
      sandboxPath: string;
      text?: string;
      fileBase64?: string;
      inlineKind?: "text" | "file";
    }
  | { status: "error"; message: string };

function isImageMime(mediaType: string): boolean {
  return mediaType.startsWith("image/");
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function inlineKindFor(
  mediaType: string,
  sizeBytes: number,
): "text" | "file" | null {
  if (TEXT_INLINE_MIME.has(mediaType)) return "text";
  if (isImageMime(mediaType) && sizeBytes <= IMAGE_INLINE_MAX_BYTES) {
    return "file";
  }
  if (mediaType === "application/pdf" && sizeBytes <= PDF_INLINE_MAX_BYTES) {
    return "file";
  }
  return null;
}

async function readFirstSandboxHit(
  sandbox: {
    readBinaryFile: (options: { path: string }) => PromiseLike<Uint8Array | null>;
    writeBinaryFile: (options: {
      path: string;
      content: Uint8Array;
    }) => PromiseLike<void>;
  },
  paths: readonly string[],
): Promise<{ bytes: Uint8Array; path: string } | null> {
  for (const path of paths) {
    try {
      const existing = await sandbox.readBinaryFile({ path });
      if (existing?.byteLength) {
        return { bytes: existing, path };
      }
    } catch {
      // Try the next candidate path.
    }
  }
  return null;
}

async function stageBytesInSandbox(
  getSandbox: () => ReturnType<
    import("eve/tools").ToolContext["getSandbox"]
  >,
  bytes: Uint8Array,
  filename: string,
): Promise<{ payload: Uint8Array; sandboxPath: string }> {
  const candidatePaths = candidateAttachmentSandboxPaths(bytes, filename);
  let sandboxPath = eveStagedAttachmentPath(bytes, filename);

  const sandbox = await getSandbox();
  const hit = await readFirstSandboxHit(sandbox, candidatePaths);
  const payload = hit?.bytes ?? bytes;
  if (hit) {
    sandboxPath = hit.path;
  } else {
    await sandbox.writeBinaryFile({ path: sandboxPath, content: payload });
  }

  return { payload, sandboxPath };
}

export default defineTool({
  description:
    "Re-load a chat attachment when it is no longer inline (compaction stub, sandbox cleanup, or user @mention). " +
    "Loads from sandbox when available, otherwise from the persistent attachment library (Blob). " +
    "Re-attaches file content to the model like the original upload. " +
    "Do NOT call when the file is still accessible via sandbox refs in recent conversation history.",
  inputSchema: z.object({
    name: z
      .string()
      .min(1)
      .describe("Exact or case-insensitive filename, e.g. report.pdf"),
  }),
  async execute({ name }, ctx): Promise<ReadChatAttachmentToolOutput> {
    const userId =
      ctx.session.auth.current?.principalId ??
      ctx.session.auth.initiator?.principalId ??
      null;
    if (!userId) {
      return {
        status: "error",
        message: "Authentication required to read chat attachments.",
      };
    }

    const result = await readChatAttachmentForSession({
      userId,
      eveSessionId: ctx.session.id,
      name,
    });

    if (result.status === "error") {
      return result;
    }

    const { attachment, bytes, text } = result;
    if (!bytes?.byteLength) {
      return {
        status: "error",
        message: `Attachment bytes missing for ${attachment.filename}.`,
      };
    }

    const inlineKind = inlineKindFor(attachment.mediaType, attachment.sizeBytes);
    const sandboxPath = eveStagedAttachmentPath(bytes, attachment.filename);

    // Re-inline text/images from Blob directly — no sandbox cold start needed.
    if (inlineKind === "text" && text !== undefined) {
      return {
        status: "ok",
        filename: attachment.filename,
        mediaType: attachment.mediaType,
        sizeBytes: attachment.sizeBytes,
        sandboxPath,
        text,
        inlineKind: "text",
        message: `Re-attached text from ${attachment.filename}.`,
      };
    }

    if (inlineKind === "file") {
      return {
        status: "ok",
        filename: attachment.filename,
        mediaType: attachment.mediaType,
        sizeBytes: attachment.sizeBytes,
        sandboxPath,
        fileBase64: bytesToBase64(bytes),
        inlineKind: "file",
        message: `Re-attached ${attachment.filename} for multimodal input.`,
      };
    }

    try {
      const staged = await stageBytesInSandbox(
        () => ctx.getSandbox(),
        bytes,
        attachment.filename,
      );
      return {
        status: "ok",
        filename: attachment.filename,
        mediaType: attachment.mediaType,
        sizeBytes: attachment.sizeBytes,
        sandboxPath: staged.sandboxPath,
        message:
          `${attachment.filename} is too large to inline (${attachment.sizeBytes} bytes). ` +
          `Staged at ${staged.sandboxPath} — use read_file or other sandbox tools.`,
      };
    } catch (err) {
      return {
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to stage attachment in sandbox.",
      };
    }
  },
  toModelOutput(output: ReadChatAttachmentToolOutput) {
    if (output.status === "error") {
      return toolOutput.text(output.message);
    }

    if (output.inlineKind === "text" && output.text !== undefined) {
      return toolOutput.content([
        toolOutputPart.text(`Contents of ${output.filename}:`),
        toolOutputPart.text(output.text),
      ]);
    }

    if (output.inlineKind === "file" && output.fileBase64) {
      return toolOutput.content([
        toolOutputPart.text(`Re-attached ${output.filename}:`),
        toolOutputPart.file(output.fileBase64, {
          mediaType: output.mediaType,
          filename: output.filename,
        }),
      ]);
    }

    return toolOutput.text(output.message);
  },
});
