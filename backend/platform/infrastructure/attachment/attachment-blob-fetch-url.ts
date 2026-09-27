import { head, issueSignedToken, presignUrl } from "@vercel/blob";
import {
  blobAccess,
  blobCommandOptions,
  hasBlobStorageConfigured,
} from "../artifact/blob-client.js";
import { blobPath } from "./attachment-storage.js";

/** Match ASR signed platform URLs / DashScope job window (2h). */
export const BLOB_ASR_PRESIGN_TTL_MS = 2 * 60 * 60 * 1000;

async function presignedGetUrlForPrivateBlob(pathname: string): Promise<string> {
  const validUntil = Date.now() + BLOB_ASR_PRESIGN_TTL_MS;
  const signed = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
    ...blobCommandOptions(),
  });
  const { presignedUrl } = await presignUrl(signed, {
    operation: "get",
    pathname,
    access: "private",
    validUntil,
    useCache: false,
  });
  return presignedUrl;
}

/**
 * HTTPS URL that external services (e.g. DashScope ASR) can GET without Omni auth.
 * Public blobs: stable blob URL. Private blobs: time-limited presigned GET URL.
 */
export async function getAttachmentExternallyFetchableUrl(input: {
  chatId: string;
  storageKey: string;
}): Promise<string | null> {
  if (!hasBlobStorageConfigured()) return null;
  const pathname = blobPath(input.chatId, input.storageKey);
  const access = blobAccess();
  const opts = { access, ...blobCommandOptions() };

  try {
    const meta = await head(pathname, opts);
    if (access === "public") {
      return meta.downloadUrl || meta.url || null;
    }
    return await presignedGetUrlForPrivateBlob(pathname);
  } catch {
    return null;
  }
}

export function isLoopbackParsePublicBase(base: string): boolean {
  try {
    const host = new URL(base).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.")
    );
  } catch {
    return false;
  }
}
