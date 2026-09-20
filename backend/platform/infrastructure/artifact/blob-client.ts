type BlobCommandOptions = {
  token?: string;
  storeId?: string;
};

/** Strip surrounding quotes from copy-paste mistakes in .env / Vercel UI. */
export function normalizeEnvSecret(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value || undefined;
}

export function blobAccess(): "public" | "private" {
  return normalizeEnvSecret(process.env.BLOB_ACCESS)?.toLowerCase() === "public"
    ? "public"
    : "private";
}

export function hasBlobStorageConfigured(): boolean {
  return Boolean(
    normalizeEnvSecret(process.env.BLOB_READ_WRITE_TOKEN) ||
      (process.env.VERCEL &&
        normalizeEnvSecret(process.env.BLOB_STORE_ID) &&
        normalizeEnvSecret(process.env.VERCEL_OIDC_TOKEN)),
  );
}

/** Shared auth for @vercel/blob get/put on Vercel and locally. */
export function blobCommandOptions(): BlobCommandOptions {
  const storeId = normalizeEnvSecret(process.env.BLOB_STORE_ID);
  const token = normalizeEnvSecret(process.env.BLOB_READ_WRITE_TOKEN);

  const options: BlobCommandOptions = {};
  if (storeId) options.storeId = storeId;

  // On Vercel prefer OIDC from the linked Blob store. Passing a bad explicit
  // token overrides OIDC and causes "Access denied" even when the store is linked.
  if (token && !process.env.VERCEL) {
    options.token = token;
  }

  return options;
}
