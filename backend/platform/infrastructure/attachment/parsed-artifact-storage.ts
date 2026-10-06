import {
  getAttachmentBytes,
  putAttachmentBytes,
} from "./attachment-storage.js";
import {
  parsedArtifactBlobKey,
  parsedArtifactObjectName,
  parsedFigureBlobKey,
  parsedFigureObjectName,
} from "../../domain/docstore/parsed-manifest.js";

async function loadBytesWithLegacyFallback(
  scopeId: string,
  blobKey: string,
  legacyObjectName: string,
): Promise<Uint8Array | null> {
  const primary = await getAttachmentBytes(scopeId, blobKey);
  if (primary?.byteLength) return primary;
  return getAttachmentBytes(scopeId, legacyObjectName);
}

export async function saveParsedArtifact(
  chatId: string,
  attachmentId: string,
  artifactKey: string,
  data: Uint8Array,
  contentType?: string,
): Promise<void> {
  await putAttachmentBytes(
    chatId,
    parsedArtifactBlobKey(attachmentId, artifactKey),
    data,
    contentType,
  );
}

export async function loadParsedArtifact(
  chatId: string,
  attachmentId: string,
  artifactKey: string,
): Promise<Uint8Array | null> {
  return loadBytesWithLegacyFallback(
    chatId,
    parsedArtifactBlobKey(attachmentId, artifactKey),
    parsedArtifactObjectName(chatId, attachmentId, artifactKey),
  );
}

export async function parsedArtifactExists(
  chatId: string,
  attachmentId: string,
  artifactKey: string,
): Promise<boolean> {
  const bytes = await loadParsedArtifact(chatId, attachmentId, artifactKey);
  return Boolean(bytes?.byteLength);
}

export async function saveParsedFigure(
  chatId: string,
  attachmentId: string,
  figureId: string,
  extension: string,
  data: Uint8Array,
  contentType?: string,
): Promise<void> {
  await putAttachmentBytes(
    chatId,
    parsedFigureBlobKey(attachmentId, figureId, extension),
    data,
    contentType,
  );
}

export async function loadParsedFigure(
  chatId: string,
  attachmentId: string,
  figureId: string,
  extension: string,
): Promise<Uint8Array | null> {
  return loadBytesWithLegacyFallback(
    chatId,
    parsedFigureBlobKey(attachmentId, figureId, extension),
    parsedFigureObjectName(chatId, attachmentId, figureId, extension),
  );
}
