import { defineDynamic } from "eve";
import { defineInstructions } from "eve/instructions";
import { listChatAttachmentsForSession } from "#platform/composition/public-api.js";
import {
  extractLatestUserText,
  filenamesNeedingRehydration,
  parseMentionedFilenames,
  readDynamicMessages,
} from "../lib/attachment-rehydrate.js";

export default defineDynamic({
  events: {
    async "turn.started"(_event, ctx) {
      const userId =
        ctx.session.auth.current?.principalId ??
        ctx.session.auth.initiator?.principalId ??
        null;
      if (!userId) return null;

      const messages = readDynamicMessages(ctx);
      const userText = extractLatestUserText(messages);
      const mentioned = parseMentionedFilenames(userText);
      if (mentioned.length === 0) return null;

      const needsRehydrate = filenamesNeedingRehydration(messages, mentioned);
      const alreadyAccessible = mentioned.filter(
        (name) => !needsRehydrate.includes(name),
      );

      if (needsRehydrate.length === 0 && alreadyAccessible.length === 0) {
        return null;
      }

      const lines: string[] = [];

      if (needsRehydrate.length > 0) {
        const attachments = await listChatAttachmentsForSession({
          userId,
          eveSessionId: ctx.session.id,
        });
        const rehydrateKeys = new Set(
          needsRehydrate.map((name) => name.toLowerCase()),
        );
        const matching = attachments.filter((item) =>
          rehydrateKeys.has(item.filename.toLowerCase()),
        );

        if (matching.length > 0) {
          lines.push(
            "Referenced attachment(s) in the persistent library:",
            ...matching.map(
              (item) =>
                `- ${item.filename} (${item.mediaType}, ${item.sizeBytes} bytes)`,
            ),
          );
        }

        const missingInLibrary = needsRehydrate.filter(
          (name) =>
            !matching.some(
              (item) => item.filename.toLowerCase() === name.toLowerCase(),
            ),
        );
        if (missingInLibrary.length > 0) {
          lines.push(
            "",
            "These @mentioned names were not found in the attachment library:",
            ...missingInLibrary.map((name) => `- ${name}`),
          );
        }

        lines.push(
          "",
          "Required this turn: the user @mentioned file(s) that are NOT accessible in context " +
            "(compaction stubs or no sandbox ref in history):",
          ...needsRehydrate.map((name) => `- ${name}`),
          "",
          "Call read_chat_attachment once per filename BEFORE answering. " +
            "The tool re-attaches bytes to you the same way as the original upload.",
        );
      } else if (alreadyAccessible.length > 0) {
        lines.push(
          "The user @mentioned file(s) that are still accessible in recent history " +
            "(Eve will hydrate sandbox refs automatically) — do NOT call read_chat_attachment for:",
          ...alreadyAccessible.map((name) => `- ${name}`),
        );
      }

      return defineInstructions({
        role: "user",
        content: lines.join("\n"),
      });
    },
  },
});
