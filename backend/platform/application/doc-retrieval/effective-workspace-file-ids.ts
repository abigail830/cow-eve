/** Union workspace file ids from project context, chat refs, and the current message. */
export function mergeWorkspaceFileIds(input: {
  projectFileIds: readonly string[];
  chatFileIds: readonly string[];
  messageFileIds: readonly string[];
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of [
    input.projectFileIds,
    input.chatFileIds,
    input.messageFileIds,
  ]) {
    for (const raw of list) {
      const id = raw.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
