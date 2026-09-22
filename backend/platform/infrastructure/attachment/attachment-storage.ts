import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { getPlatformDataDir } from "../config/platform-data.config.js";
import {
  blobAccess,
  blobCommandOptions,
  hasBlobStorageConfigured,
  normalizeEnvSecret,
} from "../artifact/blob-client.js";

const CHAT_ATTACHMENTS_DIR = "chat-attachments";

function useBlobStorage(): boolean {
  return hasBlobStorageConfigured();
}

function requireAttachmentStorage(): void {
  if (process.env.VERCEL && !useBlobStorage()) {
    throw new Error(
      "Blob storage is not configured on Vercel. Link a Blob store to this project (Storage → Blob) or set BLOB_READ_WRITE_TOKEN for Production and Preview, then redeploy.",
    );
  }
}

async function readBlobBytes(pathname: string): Promise<Uint8Array | null> {
  const result = await get(pathname, {
    access: blobAccess(),
    ...blobCommandOptions(),
  });
  if (!result?.stream) return null;
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}

function localObjectPath(chatId: string, objectName: string): string {
  return path.join(
    getPlatformDataDir(),
    CHAT_ATTACHMENTS_DIR,
    chatId,
    objectName,
  );
}

function blobPath(chatId: string, objectName: string): string {
  return `${CHAT_ATTACHMENTS_DIR}/${chatId}/${objectName}`;
}

function wrapBlobError(err: unknown, action: string): Error {
  const detail = err instanceof Error ? err.message : String(err);
  const tokenHint = normalizeEnvSecret(process.env.BLOB_READ_WRITE_TOKEN)
    ? "Check BLOB_READ_WRITE_TOKEN has no surrounding quotes and matches the linked Blob store, or remove the manual token and rely on the Storage integration + OIDC."
    : "Link a Blob store in Vercel Storage so OIDC + BLOB_STORE_ID are injected, or set BLOB_READ_WRITE_TOKEN.";
  return new Error(`Blob ${action} failed: ${detail}. ${tokenHint}`);
}

export async function putAttachmentBytes(
  chatId: string,
  objectName: string,
  data: Uint8Array,
  contentType?: string,
): Promise<void> {
  requireAttachmentStorage();
  if (useBlobStorage()) {
    try {
      await put(blobPath(chatId, objectName), Buffer.from(data), {
        access: blobAccess(),
        contentType: contentType ?? "application/octet-stream",
        addRandomSuffix: false,
        ...blobCommandOptions(),
      });
    } catch (err) {
      throw wrapBlobError(err, "upload");
    }
    return;
  }
  const filePath = localObjectPath(chatId, objectName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

export async function getAttachmentBytes(
  chatId: string,
  objectName: string,
): Promise<Uint8Array | null> {
  if (useBlobStorage()) {
    try {
      return await readBlobBytes(blobPath(chatId, objectName));
    } catch (err) {
      console.error("[attachment-storage] blob read failed", {
        chatId,
        objectName,
        error: err instanceof Error ? err.message : err,
      });
      return null;
    }
  }
  try {
    return await readFile(localObjectPath(chatId, objectName));
  } catch {
    return null;
  }
}

export async function deleteAttachmentBytes(
  chatId: string,
  objectName: string,
): Promise<void> {
  if (useBlobStorage()) {
    // Vercel Blob has no delete in the minimal API we use; orphan cleanup is acceptable for v1.
    return;
  }
  try {
    await unlink(localObjectPath(chatId, objectName));
  } catch {
    // ignore missing files
  }
}
