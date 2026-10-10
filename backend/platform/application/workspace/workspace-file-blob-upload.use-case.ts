import { head } from "@vercel/blob";
import { classifyAttachment } from "../../domain/attachment/attachment-kinds.js";
import { workspaceLibraryId } from "../../domain/document/document-scope.js";
import {
  ATTACHMENT_MAX_BYTES_PER_FILE,
  CHAT_ATTACHMENT_ALLOWED_MEDIA_TYPES,
} from "../../infrastructure/config/attachment-limits.config.js";
import {
  blobCommandOptions,
  hasBlobStorageConfigured,
} from "../../infrastructure/artifact/blob-client.js";
import { blobPath } from "../../infrastructure/attachment/attachment-storage.js";
import { drizzleWorkspaceRepository } from "../../infrastructure/persistence/workspace/drizzle-workspace.repository.js";
import {
  createWorkspaceFileAndStartParse,
  toPublic,
  type WorkspaceFilePublic,
} from "./workspace-file.use-case.js";

export type WorkspaceBlobUploadClientPayload = {
  v: 1;
  scope: "workspace";
  userId: string;
  folderId: string;
  fileId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
};

function storageKeyFor(fileId: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-()+ ]+/g, "_") || "file";
  return `${fileId}/${safe}`;
}

export function workspaceFileBlobPathname(
  userId: string,
  fileId: string,
  filename: string,
): string {
  const scopeId = workspaceLibraryId(userId);
  return blobPath(scopeId, storageKeyFor(fileId, filename));
}

export function parseWorkspaceBlobUploadClientPayload(
  raw: string | null,
): WorkspaceBlobUploadClientPayload | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as WorkspaceBlobUploadClientPayload;
    if (data.v !== 1 || data.scope !== "workspace") return null;
    if (
      !data.userId ||
      !data.folderId ||
      !data.fileId ||
      !data.filename
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function prepareWorkspaceFileBlobUpload(input: {
  userId: string;
  folderId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
}): Promise<
  | {
      fileId: string;
      folderId: string;
      pathname: string;
      clientPayload: string;
    }
  | { error: string }
> {
  if (!hasBlobStorageConfigured()) {
    return { error: "Direct blob upload is not configured on this deployment." };
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > ATTACHMENT_MAX_BYTES_PER_FILE) {
    return {
      error: `File size must be between 1 byte and ${ATTACHMENT_MAX_BYTES_PER_FILE} bytes.`,
    };
  }

  const folder = await drizzleWorkspaceRepository.getFolderForUser({
    userId: input.userId,
    folderId: input.folderId,
  });
  if (!folder) return { error: "Folder not found." };

  try {
    classifyAttachment({
      filename: input.filename,
      mimeType: input.mediaType,
    });
  } catch {
    return { error: "Unsupported file type." };
  }

  const fileId = crypto.randomUUID();
  const pathname = workspaceFileBlobPathname(
    input.userId,
    fileId,
    input.filename,
  );
  const payload: WorkspaceBlobUploadClientPayload = {
    v: 1,
    scope: "workspace",
    userId: input.userId,
    folderId: input.folderId,
    fileId,
    filename: input.filename,
    mediaType: input.mediaType,
    sizeBytes: input.sizeBytes,
  };

  return {
    fileId,
    folderId: input.folderId,
    pathname,
    clientPayload: JSON.stringify(payload),
  };
}

export async function finalizeWorkspaceFileBlobUpload(input: {
  userId: string;
  folderId: string;
  fileId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
}): Promise<{ file: WorkspaceFilePublic | null; error?: string }> {
  if (!hasBlobStorageConfigured()) {
    return { file: null, error: "Blob storage is not configured." };
  }

  const folder = await drizzleWorkspaceRepository.getFolderForUser({
    userId: input.userId,
    folderId: input.folderId,
  });
  if (!folder) return { file: null, error: "Folder not found." };

  const pathname = workspaceFileBlobPathname(
    input.userId,
    input.fileId,
    input.filename,
  );
  const storageKey = storageKeyFor(input.fileId, input.filename);

  try {
    const meta = await head(pathname, blobCommandOptions());
    if (!meta) {
      return {
        file: null,
        error: "Uploaded file not found in blob storage yet. Retry in a moment.",
      };
    }
  } catch {
    return {
      file: null,
      error: "Uploaded file not found in blob storage. Upload may have failed.",
    };
  }

  const existing = await drizzleWorkspaceRepository.getFileByIdOnly(input.fileId);
  if (existing) {
    if (existing.userId !== input.userId) {
      return { file: null, error: "File not found." };
    }
    return { file: toPublic(existing) };
  }

  const sizeBytes = input.sizeBytes > 0 ? input.sizeBytes : 0;

  return createWorkspaceFileAndStartParse({
    userId: input.userId,
    folderId: input.folderId,
    fileId: input.fileId,
    filename: input.filename,
    mediaType: input.mediaType,
    sizeBytes,
    storageKey,
    contentHash: null,
  });
}

export { CHAT_ATTACHMENT_ALLOWED_MEDIA_TYPES, ATTACHMENT_MAX_BYTES_PER_FILE };
