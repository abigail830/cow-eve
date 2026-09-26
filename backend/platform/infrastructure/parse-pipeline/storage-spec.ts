function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function buildInternalStorageSpec(input: {
  publicBaseUrl: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string | null;
  runToken: string;
}): Record<string, unknown> {
  const fileBase = joinUrl(
    input.publicBaseUrl,
    `/internal/parse/v1/files/${input.attachmentId}`,
  );
  const authHeaders = { Authorization: `Bearer ${input.runToken}` };
  return {
    read: {
      url: `${fileBase}/original`,
      method: "GET",
      filename: input.filename,
      content_type: input.mimeType,
      size_bytes: input.sizeBytes,
      headers: authHeaders,
      ...(input.contentHash ? { sha256: input.contentHash } : {}),
    },
    write: {
      artifacts_batch: {
        url: `${fileBase}/artifacts/batch`,
        method: "PUT",
        headers: authHeaders,
      },
      content_md: {
        url: `${fileBase}/artifacts/content_md`,
        method: "PUT",
        content_type: "text/markdown; charset=utf-8",
        headers: authHeaders,
      },
      meta_json: {
        url: `${fileBase}/artifacts/meta_json`,
        method: "PUT",
        content_type: "application/json",
        headers: authHeaders,
      },
      pageindex_json: {
        url: `${fileBase}/artifacts/pageindex_json`,
        method: "PUT",
        content_type: "application/json",
        headers: authHeaders,
      },
    },
  };
}
