export type DocumentSourceKind = "chat_attachment" | "workspace_file";

export type DocumentScope = {
  kind: DocumentSourceKind;
  /** Blob + parsed artifact scope (chatId or workspace libraryId). */
  scopeId: string;
  fileId: string;
};

export function workspaceLibraryId(userId: string): string {
  return `workspace-library-${userId}`;
}

export function parseDocumentRefId(scope: DocumentScope): string {
  return scope.kind === "workspace_file"
    ? `ws:${scope.fileId}`
    : scope.fileId;
}

export function parseDocumentRef(ref: string): DocumentScope | null {
  const trimmed = ref.trim();
  if (trimmed.startsWith("ws:")) {
    const fileId = trimmed.slice(3).trim();
    if (!fileId) return null;
    return { kind: "workspace_file", scopeId: "", fileId };
  }
  if (/^[0-9a-f-]{36}$/i.test(trimmed)) {
    return { kind: "chat_attachment", scopeId: "", fileId: trimmed };
  }
  return null;
}
