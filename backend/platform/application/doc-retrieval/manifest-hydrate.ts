import type { ChatAttachmentIndexEntry } from "./chat-library.js";
import { loadContentMd } from "./chat-library.js";

const PREVIEW_MAX_BYTES = 4_000;

function previewSnippet(content: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(content);
  if (encoded.byteLength <= maxBytes) return content.trim();
  return `${new TextDecoder().decode(encoded.slice(0, maxBytes)).trim()}…`;
}

export function buildTurnAttachmentBlock(
  entry: ChatAttachmentIndexEntry,
  contentPreview?: string | null,
): string {
  const pagePart = entry.pageCount ? `, ${entry.pageCount} pages` : "";
  const linePart =
    entry.lineCount && !entry.pageCount ? `, ${entry.lineCount} lines` : "";
  const figurePart = entry.figureCount ? `, ${entry.figureCount} figures` : "";
  const lines = [
    `- ${entry.filename} (attachment_id=${entry.attachmentId}, ${entry.kind}${pagePart}${linePart}${figurePart})`,
    "  Tools: attachment_grep → attachment_read → attachment_read_figure (for figure:fN)",
  ];
  if (contentPreview) {
    lines.push(`  Preview:\n\`\`\`\n${previewSnippet(contentPreview, PREVIEW_MAX_BYTES)}\n\`\`\``);
  }
  return lines.join("\n");
}

export async function buildHydrateTextForEntries(
  chatId: string,
  entries: ChatAttachmentIndexEntry[],
): Promise<string> {
  if (entries.length === 0) return "";
  const blocks: string[] = ["### Attachments this message"];
  for (const entry of entries) {
    let preview: string | null = null;
    try {
      preview = await loadContentMd(chatId, entry.attachmentId);
    } catch {
      preview = null;
    }
    blocks.push(buildTurnAttachmentBlock(entry, preview));
  }
  blocks.push(
    "",
    "Parsed documents are NOT fully inlined. Use attachment_grep and attachment_read with attachment_id.",
  );
  return blocks.join("\n");
}
