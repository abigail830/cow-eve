import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { getPlatformDataDir } from "../config/platform-data.config.js";

const CHAT_ARTIFACTS_DIR = "chat-artifacts";

function useBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function requireArtifactStorage(): void {
  if (process.env.VERCEL && !useBlobStorage()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required on Vercel to persist artifacts. Link a Blob store in the Vercel project and add the read/write token to env.",
    );
  }
}

/** Private stores reject `access: "public"`. Override with BLOB_ACCESS=public. */
function blobAccess(): "public" | "private" {
  return process.env.BLOB_ACCESS?.trim().toLowerCase() === "public" ? "public" : "private";
}

async function readBlobBytes(pathname: string): Promise<Uint8Array | null> {
  const result = await get(pathname, { access: blobAccess() });
  if (!result?.stream) return null;
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}

function localObjectPath(chatId: string, objectName: string): string {
  return path.join(getPlatformDataDir(), CHAT_ARTIFACTS_DIR, chatId, objectName);
}

function blobPath(chatId: string, objectName: string): string {
  return `chat-artifacts/${chatId}/${objectName}`;
}

export async function putArtifactBytes(
  chatId: string,
  objectName: string,
  data: Uint8Array,
  contentType?: string,
): Promise<void> {
  requireArtifactStorage();
  if (useBlobStorage()) {
    await put(blobPath(chatId, objectName), Buffer.from(data), {
      access: blobAccess(),
      contentType: contentType ?? "application/octet-stream",
      addRandomSuffix: false,
    });
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
    } catch {
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
    await put(blobPath(chatId, `${artifactId}.meta.json`), payload, {
      access: blobAccess(),
      contentType: "application/json",
      addRandomSuffix: false,
    });
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
    } catch {
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
