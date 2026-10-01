import { defineDynamic } from "eve";
import { defineInstructions } from "eve/instructions";
import {
  buildHydrateTextForEntries,
  buildSessionDocumentLibrary,
  classifyAttachment,
  listWorkspaceFilesForDocumentIndex,
  PARSE_READY_STATUSES,
  type DocumentIndexEntry,
} from "#platform/composition/public-api.js";
import {
  extractLatestUserText,
  filenamesNeedingRehydration,
  parseMentionedFilenames,
  parseSendAttachmentIdsFromMessages,
  parseWorkspaceFileIdsFromMessages,
  readDynamicMessages,
} from "../lib/attachment-rehydrate.js";
import { resolveChatIdForSession } from "../lib/resolve-chat-id.js";

function isImageEntry(entry: Pick<DocumentIndexEntry, "filename" | "mimeType">): boolean {
  try {
    return classifyAttachment({ filename: entry.filename, mimeType: entry.mimeType }) === "image";
  } catch {
    return false;
  }
}

function entriesForMentionedFilenames(
  library: Map<string, DocumentIndexEntry>,
  mentioned: readonly string[],
): DocumentIndexEntry[] {
  const keys = new Set(mentioned.map((n) => n.toLowerCase()));
  const out: DocumentIndexEntry[] = [];
  const seen = new Set<string>();
  for (const entry of library.values()) {
    if (seen.has(entry.refId)) continue;
    if (!keys.has(entry.filename.toLowerCase())) continue;
    seen.add(entry.refId);
    out.push(entry);
  }
  return out;
}

function isParsedDocumentReady(entry: DocumentIndexEntry): boolean {
  return PARSE_READY_STATUSES.has(entry.parseStatus);
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
      const workspaceFileIds = parseWorkspaceFileIdsFromMessages(messages);
      if (
        mentioned.length === 0 &&
        sendAttachmentIds.length === 0 &&
        workspaceFileIds.length === 0
      ) {
        return null;
      }

      const chatId = await resolveChatIdForSession({
        userId,
        eveSessionId: ctx.session.id,
      });

      const lines: string[] = [];

      if (workspaceFileIds.length > 0) {
        lines.push(
          "Workspace files referenced this thread (use ws:<uuid> as attachment_id):",
          ...workspaceFileIds.map((id) => `- ws:${id}`),
          "- Do not assume file bodies are inline; use attachment_read / attachment_grep.",
        );
      }

      const needsRehydrate = filenamesNeedingRehydration(messages, mentioned);
      const alreadyAccessible = mentioned.filter(
        (name) => !needsRehydrate.includes(name),
      );

      if (chatId) {
        const library = await buildSessionDocumentLibrary({
          chatId,
          userId,
          workspaceFileIds,
        });

        const mentionedEntries = entriesForMentionedFilenames(library, mentioned);
        const hydrateEntries = mentionedEntries.filter(
          (entry) => !isImageEntry(entry) && isParsedDocumentReady(entry),
        );

        if (hydrateEntries.length > 0) {
          const chatHydrate = hydrateEntries.filter((e) => e.source === "chat");
          if (chatHydrate.length > 0) {
            const hydrateText = await buildHydrateTextForEntries(
              chatId,
              chatHydrate,
            );
            if (hydrateText) lines.push(hydrateText);
          }
        }

        const imageRehydrate = mentionedEntries.filter(
          (entry) =>
            isImageEntry(entry) &&
            needsRehydrate.some(
              (name) => name.toLowerCase() === entry.filename.toLowerCase(),
            ),
        );
        if (imageRehydrate.length > 0) {
          lines.push(
            "",
            "Images @mentioned that need read_chat_attachment (not in recent inline context):",
            ...imageRehydrate.map(
              (entry) =>
                `- ${entry.filename} (${entry.source}, attachment_id=${entry.refId})`,
            ),
          );
        }

        const docPending = mentionedEntries.filter(
          (entry) => !isImageEntry(entry) && !PARSE_READY_STATUSES.has(entry.parseStatus),
        );
        if (docPending.length > 0) {
          lines.push(
            "",
            "These documents are still parsing — wait or tell the user to retry:",
            ...docPending.map(
              (entry) =>
                `- ${entry.filename} (source=${entry.source}, parse_status=${entry.parseStatus})`,
            ),
          );
        }
      }

      const wsPending = await listWorkspaceFilesForDocumentIndex({
        userId,
        fileIds: workspaceFileIds,
      });
      const pendingWs = wsPending.filter(
        (row) => !PARSE_READY_STATUSES.has(row.parseStatus),
      );
      if (pendingWs.length > 0) {
        lines.push(
          "",
          "Workspace imports still parsing:",
          ...pendingWs.map(
            (row) => `- ${row.filename} (ws:${row.id}, parse_status=${row.parseStatus})`,
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
        "- Workspace imports: attachment_id is ws:<workspace_file_uuid>.",
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
