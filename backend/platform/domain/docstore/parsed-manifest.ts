/** DB-backed manifest for parsed attachment artifacts — agent-platform docstore/manifest.py */

const MANIFEST_VERSION = 1;

const ARTIFACT_FILENAMES: Record<string, string> = {
  content_md: "content.md",
  meta_json: "meta.json",
  pageindex_json: "pageindex.json",
};

export const PARSED_ARTIFACT_KEYS = [
  "content_md",
  "meta_json",
  "pageindex_json",
] as const;

export function parsedArtifactPrefix(
  chatId: string,
  attachmentId: string,
): string {
  return `chat-attachments/${chatId}/parsed/${attachmentId}`;
}

export function parsedArtifactObjectName(
  chatId: string,
  attachmentId: string,
  artifactKey: string,
): string {
  const filename = ARTIFACT_FILENAMES[artifactKey] ?? artifactKey;
  return `${parsedArtifactPrefix(chatId, attachmentId)}/${filename}`;
}

export function parsedFigureObjectName(
  chatId: string,
  attachmentId: string,
  figureId: string,
  extension: string,
): string {
  const ext = extension.replace(/^\./, "");
  return `${parsedArtifactPrefix(chatId, attachmentId)}/figures/${figureId}.${ext}`;
}

export function emptyParsedArtifactManifest(
  chatId: string,
  attachmentId: string,
): Record<string, unknown> {
  return {
    version: MANIFEST_VERSION,
    storage: "blob_or_local",
    prefix: parsedArtifactPrefix(chatId, attachmentId),
    artifacts: {},
  };
}

export function mergeParsedArtifactRecord(
  manifest: Record<string, unknown> | null | undefined,
  input: {
    chatId: string;
    attachmentId: string;
    artifactKey: string;
    sizeBytes: number;
    contentType?: string;
  },
): Record<string, unknown> {
  const base = {
    ...(manifest ?? emptyParsedArtifactManifest(input.chatId, input.attachmentId)),
  };
  const artifacts = {
    ...((base.artifacts as Record<string, unknown>) ?? {}),
  };
  const filename = ARTIFACT_FILENAMES[input.artifactKey] ?? input.artifactKey;
  artifacts[input.artifactKey] = {
    artifact_key: input.artifactKey,
    relative_path: filename,
    storage_path: parsedArtifactObjectName(
      input.chatId,
      input.attachmentId,
      input.artifactKey,
    ),
    size_bytes: input.sizeBytes,
    content_type: input.contentType ?? "application/octet-stream",
    updated_at: new Date().toISOString(),
  };
  return {
    version: MANIFEST_VERSION,
    storage: base.storage ?? "blob_or_local",
    prefix: parsedArtifactPrefix(input.chatId, input.attachmentId),
    artifacts,
  };
}

export function parsedArtifactInManifest(
  manifest: Record<string, unknown> | null | undefined,
  artifactKey: string,
): boolean {
  const artifacts = manifest?.artifacts;
  if (!artifacts || typeof artifacts !== "object") return false;
  return artifactKey in (artifacts as Record<string, unknown>);
}
