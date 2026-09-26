import { defineDynamic } from "eve";
import { defineInstructions } from "eve/instructions";
import {
  buildChatLibrary,
  buildHydrateTextForEntries,
  listChatAttachmentsForSession,
  type ChatAttachmentIndexEntry,
  classifyAttachment,
  PARSE_READY_STATUSES,
  parsedArtifactInManifest,
} from "#platform/composition/public-api.js";
import {
  extractLatestUserText,
  filenamesNeedingRehydration,
  parseMentionedFilenames,
  parseSendAttachmentIdsFromMessages,
  readDynamicMessages,
} from "../lib/attachment-rehydrate.js";
import { resolveChatIdForSession } from "../lib/resolve-chat-id.js";

function isImageAttachment(filename: string, mediaType: string): boolean {
  try {
    return classifyAttachment({ filename, mimeType: mediaType }) === "image";
  } catch {
    return false;
  }
}

function isParsedDocumentReady(
  entry: ChatAttachmentIndexEntry,
  manifest: Record<string, unknown> | null | undefined,
): boolean {
  return (
    PARSE_READY_STATUSES.has(entry.parseStatus) &&
    parsedArtifactInManifest(manifest ?? null, "content_md")
  );
}

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
      const sendAttachmentIds = parseSendAttachmentIdsFromMessages(messages);
      if (mentioned.length === 0 && sendAttachmentIds.length === 0) return null;

      const chatId = await resolveChatIdForSession({
        userId,
        eveSessionId: ctx.session.id,
      });

      const needsRehydrate = filenamesNeedingRehydration(messages, mentioned);
      const alreadyAccessible = mentioned.filter(
        (name) => !needsRehydrate.includes(name),
      );

      const attachments = await listChatAttachmentsForSession({
        userId,
        eveSessionId: ctx.session.id,
      });

      const mentionKeys = new Set(mentioned.map((n) => n.toLowerCase()));
      const sendIdSet = new Set(sendAttachmentIds);
      const mentionedRows = attachments.filter(
        (item) =>
          mentionKeys.has(item.filename.toLowerCase()) || sendIdSet.has(item.id),
      );

      const hydrateEntries: ChatAttachmentIndexEntry[] = [];
      if (chatId) {
        const library = await buildChatLibrary(chatId);
        for (const row of mentionedRows) {
          if (isImageAttachment(row.filename, row.mediaType)) continue;
          const entry = library.get(row.id);
          if (entry && isParsedDocumentReady(entry, row.parsedArtifactManifest)) {
            hydrateEntries.push(entry);
          }
        }
      }

      const lines: string[] = [];

      if (hydrateEntries.length > 0 && chatId) {
        const hydrateText = await buildHydrateTextForEntries(
          chatId,
          hydrateEntries,
        );
        if (hydrateText) lines.push(hydrateText);
      }

      const imageRehydrate = needsRehydrate.filter((name) => {
        const row = mentionedRows.find(
          (item) => item.filename.toLowerCase() === name.toLowerCase(),
        );
        return row && isImageAttachment(row.filename, row.mediaType);
      });

      if (imageRehydrate.length > 0) {
        lines.push(
          "",
          "Images @mentioned that need read_chat_attachment (not in recent inline context):",
          ...imageRehydrate.map((name) => `- ${name}`),
        );
      }

      const docPending = mentionedRows.filter((row) => {
        if (isImageAttachment(row.filename, row.mediaType)) return false;
        return !PARSE_READY_STATUSES.has(row.parseStatus);
      });
      if (docPending.length > 0) {
        lines.push(
          "",
          "These attachments are still parsing — wait or tell the user to retry:",
          ...docPending.map(
            (row) =>
              `- ${row.filename} (parse_status=${row.parseStatus})`,
          ),
        );
      }

      if (alreadyAccessible.length > 0) {
        lines.push(
          "",
          "Still accessible in recent history (Eve hydrates sandbox refs) — do NOT call read_chat_attachment:",
          ...alreadyAccessible.map((name) => `- ${name}`),
        );
      }

      if (lines.length === 0) return null;

      lines.unshift(
        "Chat attachment guidance (aligned with agent-platform doc retrieval):",
        "- Parsed PDF/sheet/text/audio: use attachment_grep / attachment_read with attachment_id.",
        "- Figure placeholders (figure:fN): use attachment_read_figure.",
        "- Images: inline vision when bytes are in context; otherwise read_chat_attachment.",
      );

      return defineInstructions({
        role: "user",
        content: lines.join("\n"),
      });
    },
  },
});
