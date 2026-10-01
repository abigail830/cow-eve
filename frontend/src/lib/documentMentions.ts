import type { MentionAttachmentOption } from "./attachmentUpload";

function mentionMatchesSorted(options: readonly MentionAttachmentOption[]) {
  return [...options]
    .sort((a, b) => b.filename.length - a.filename.length)
    .map((item) => ({
      item,
      token: `@${item.filename}`,
    }));
}

export function mergeExplicitMentionIds(
  fromText: { attachmentIds: string[]; workspaceFileIds: string[] },
  explicit: readonly MentionAttachmentOption[],
): { attachmentIds: string[]; workspaceFileIds: string[] } {
  const attachmentIds = [...fromText.attachmentIds];
  const workspaceFileIds = [...fromText.workspaceFileIds];
  const attSet = new Set(attachmentIds);
  const wsSet = new Set(workspaceFileIds);

  for (const item of explicit) {
    if (item.source === "workspace") {
      if (!wsSet.has(item.id)) {
        wsSet.add(item.id);
        workspaceFileIds.push(item.id);
      }
      continue;
    }
    if (!attSet.has(item.id)) {
      attSet.add(item.id);
      attachmentIds.push(item.id);
    }
  }

  return { attachmentIds, workspaceFileIds };
}

export function parseDocumentMentionIds(
  text: string,
  options: readonly MentionAttachmentOption[],
): { attachmentIds: string[]; workspaceFileIds: string[] } {
  const attachmentIds: string[] = [];
  const workspaceFileIds: string[] = [];
  if (!text || options.length === 0) {
    return { attachmentIds, workspaceFileIds };
  }

  const matches = mentionMatchesSorted(options);
  let index = 0;
  while (index < text.length) {
    if (text[index] !== "@") {
      index += 1;
      continue;
    }
    let matched = false;
    for (const { item, token } of matches) {
      if (text.slice(index, index + token.length) !== token) continue;
      if (item.source === "workspace") {
        workspaceFileIds.push(item.id);
      } else {
        attachmentIds.push(item.id);
      }
      index += token.length;
      matched = true;
      break;
    }
    if (!matched) index += 1;
  }

  return {
    attachmentIds: [...new Set(attachmentIds)],
    workspaceFileIds: [...new Set(workspaceFileIds)],
  };
}
