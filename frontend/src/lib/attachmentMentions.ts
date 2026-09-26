import type { ChatAttachmentPublic } from "./attachmentUpload";

function mentionMatchesSorted(attachments: readonly ChatAttachmentPublic[]) {
  return [...attachments]
    .sort((a, b) => b.filename.length - a.filename.length)
    .map((att) => ({
      att,
      token: `@${att.filename}`,
    }));
}

/** Resolve `@filename` tokens in message text to attachment IDs (longest filename first). */
export function parseAttachmentMentionIds(
  text: string,
  attachments: readonly ChatAttachmentPublic[],
): string[] {
  if (!text || attachments.length === 0) return [];
  const matches = mentionMatchesSorted(attachments);
  const ids: string[] = [];
  let index = 0;
  while (index < text.length) {
    if (text[index] !== "@") {
      index += 1;
      continue;
    }
    let matched = false;
    for (const { att, token } of matches) {
      if (text.slice(index, index + token.length) === token) {
        ids.push(att.id);
        index += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) index += 1;
  }
  return [...new Set(ids)];
}
