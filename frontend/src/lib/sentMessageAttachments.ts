/** Durable UI hints: Eve clientContext is turn-scoped and often absent from message history. */
export type UserMessageAttachmentHint = {
  attachmentId: string;
  filename: string;
  mediaType: string;
  sizeBytes?: number;
};

export type PendingSendAttachmentHint = {
  text: string;
  items: UserMessageAttachmentHint[];
};

export function hintsFromPrepared(
  attachments: readonly {
    platformId?: string;
    filename: string;
    mediaType: string;
    sizeBytes: number;
  }[],
  attachmentIds: readonly string[],
): UserMessageAttachmentHint[] {
  const byId = new Map<string, UserMessageAttachmentHint>();
  for (const item of attachments) {
    if (!item.platformId) continue;
    byId.set(item.platformId, {
      attachmentId: item.platformId,
      filename: item.filename,
      mediaType: item.mediaType,
      sizeBytes: item.sizeBytes,
    });
  }
  const ordered: UserMessageAttachmentHint[] = [];
  const seen = new Set<string>();
  for (const id of attachmentIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const row = byId.get(id);
    if (row) ordered.push(row);
  }
  return ordered;
}

export function messageMatchesSendHint(
  visibleText: string,
  hint: PendingSendAttachmentHint,
): boolean {
  const text = visibleText.trim();
  const sent = hint.text.trim();
  if (sent.length > 0) return text === sent;
  return hint.items.length > 0 && text.length === 0;
}
