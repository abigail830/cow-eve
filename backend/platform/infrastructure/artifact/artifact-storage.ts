import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { getPlatformDataDir } from "../config/platform-data.config.js";
import {
  blobAccess,
  blobCommandOptions,
  hasBlobStorageConfigured,
  normalizeEnvSecret,
} from "./blob-client.js";

const CHAT_ARTIFACTS_DIR = "chat-artifacts";

function useBlobStorage(): boolean {
  return hasBlobStorageConfigured();
}

function requireArtifactStorage(): void {
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
  return path.join(getPlatformDataDir(), CHAT_ARTIFACTS_DIR, chatId, objectName);
}

function blobPath(chatId: string, objectName: string): string {
  return `chat-artifacts/${chatId}/${objectName}`;
}

function wrapBlobError(err: unknown, action: string): Error {
  const detail = err instanceof Error ? err.message : String(err);
  const tokenHint = normalizeEnvSecret(process.env.BLOB_READ_WRITE_TOKEN)
    ? "Check BLOB_READ_WRITE_TOKEN has no surrounding quotes and matches the linked Blob store, or remove the manual token and rely on the Storage integration + OIDC."
    : "Link a Blob store in Vercel Storage so OIDC + BLOB_STORE_ID are injected, or set BLOB_READ_WRITE_TOKEN.";
  return new Error(`Blob ${action} failed: ${detail}. ${tokenHint}`);
}

export async function putArtifactBytes(
  chatId: string,
  objectName: string,
  data: Uint8Array,
  contentType?: string,
): Promise<void> {
  requireArtifactStorage();
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

export async function getArtifactBytes(
  chatId: string,
  objectName: string,
): Promise<Uint8Array | null> {
  if (useBlobStorage()) {
    try {
      return await readBlobBytes(blobPath(chatId, objectName));
    } catch (err) {
      console.error("[artifact-storage] blob read failed", {
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

export async function putArtifactMeta(
  chatId: string,
  artifactId: string,
  meta: Record<string, unknown>,
): Promise<void> {
  requireArtifactStorage();
  const payload = JSON.stringify(meta);
  if (useBlobStorage()) {
    try {
      await put(blobPath(chatId, `${artifactId}.meta.json`), payload, {
        access: blobAccess(),
        contentType: "application/json",
        addRandomSuffix: false,
        ...blobCommandOptions(),
      });
    } catch (err) {
      throw wrapBlobError(err, "upload");
    }
    return;
  }
  const filePath = localObjectPath(chatId, `${artifactId}.meta.json`);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, payload, "utf8");
}

export async function getArtifactMeta(
  chatId: string,
  artifactId: string,
): Promise<Record<string, unknown> | null> {
  if (useBlobStorage()) {
    try {
      const bytes = await readBlobBytes(blobPath(chatId, `${artifactId}.meta.json`));
      if (!bytes) return null;
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch (err) {
      console.error("[artifact-storage] blob meta read failed", {
        chatId,
        artifactId,
        error: err instanceof Error ? err.message : err,
      });
      return null;
    }
  }
  try {
    const raw = await readFile(localObjectPath(chatId, `${artifactId}.meta.json`), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
