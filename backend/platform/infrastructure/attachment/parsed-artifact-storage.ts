import {
  getAttachmentBytes,
  putAttachmentBytes,
} from "./attachment-storage.js";
import {
  parsedArtifactObjectName,
  parsedFigureObjectName,
} from "../../domain/docstore/parsed-manifest.js";

export async function saveParsedArtifact(
  chatId: string,
  attachmentId: string,
  artifactKey: string,
  data: Uint8Array,
  contentType?: string,
): Promise<void> {
  const objectName = parsedArtifactObjectName(chatId, attachmentId, artifactKey);
  await putAttachmentBytes(chatId, objectName, data, contentType);
}

export async function loadParsedArtifact(
  chatId: string,
  attachmentId: string,
  artifactKey: string,
): Promise<Uint8Array | null> {
  const objectName = parsedArtifactObjectName(chatId, attachmentId, artifactKey);
  return getAttachmentBytes(chatId, objectName);
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
  const objectName = parsedFigureObjectName(
    chatId,
    attachmentId,
    figureId,
    extension,
  );
  await putAttachmentBytes(chatId, objectName, data, contentType);
}

export async function loadParsedFigure(
  chatId: string,
  attachmentId: string,
  figureId: string,
  extension: string,
): Promise<Uint8Array | null> {
  const objectName = parsedFigureObjectName(
    chatId,
    attachmentId,
    figureId,
    extension,
  );
  return getAttachmentBytes(chatId, objectName);
}
