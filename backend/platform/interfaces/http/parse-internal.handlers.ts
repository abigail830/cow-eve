import {
  mintAsrFileUrls,
  readAsrFileForSignedUrl,
} from "../../application/parse/parse-asr.use-case.js";
import {
  applyParseWebhook,
  getParseJobPayloadForRun,
  reportParseRunStatusFromGha,
  verifyWebhookSignature,
} from "../../application/parse/parse-webhook.use-case.js";
import { getAttachmentBytes } from "../../infrastructure/attachment/attachment-storage.js";
import {
  loadParsedFigure,
  saveParsedArtifact,
  saveParsedFigure,
} from "../../infrastructure/attachment/parsed-artifact-storage.js";
import { hashRunToken } from "../../infrastructure/parse-pipeline/job-builder.js";
import { resolveParseableFile } from "../../application/document/parse-document-router.js";
import { recordParsedArtifactsForRun } from "../../application/document/parse-document-router.js";
import { materializeEmailDerivedAttachments } from "../../application/attachment/email-derived.use-case.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import {
  getParseJobRunForAttachmentToken,
  getParseJobRunByJobId,
} from "../../infrastructure/persistence/parse/drizzle-parse-job.repository.js";

function extractBearer(authorization: string | null): string | null {
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  return authorization.split(" ", 2)[1]?.trim() ?? null;
}

export async function handleAsrFilesMint(
  jobId: string,
  request: Request,
): Promise<Response> {
  const token = extractBearer(request.headers.get("authorization"));
  if (!token) {
    return Response.json({ error: "missing bearer token" }, { status: 401 });
  }
  let body: { attachment_ids?: string[] };
  try {
    body = (await request.json()) as { attachment_ids?: string[] };
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const attachmentIds = Array.isArray(body.attachment_ids)
    ? body.attachment_ids.map(String)
    : [];
  const minted = await mintAsrFileUrls({
    jobId,
    bearerToken: token,
    attachmentIds,
  });
  if (!minted) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return Response.json(minted);
}

export async function handleAsrFileDownload(
  attachmentId: string,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("job_id") ?? "";
  const exp = Number.parseInt(url.searchParams.get("exp") ?? "", 10);
  const sig = url.searchParams.get("sig") ?? "";
  if (!jobId || !sig || !Number.isFinite(exp)) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }
  const file = await readAsrFileForSignedUrl({
    jobId,
    attachmentId,
    exp,
    sig,
  });
  if (!file) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return new Response(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.mediaType,
      "cache-control": "private, no-store",
    },
  });
}

export async function handleParseRunPayload(
  jobId: string,
  request: Request,
): Promise<Response> {
  const token = extractBearer(request.headers.get("authorization"));
  if (!token) {
    return Response.json({ error: "missing bearer token" }, { status: 401 });
  }
  const payload = await getParseJobPayloadForRun(jobId, token);
  if (!payload) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return Response.json(payload);
}

export async function handleParseRunStatus(
  jobId: string,
  request: Request,
): Promise<Response> {
  const token = extractBearer(request.headers.get("authorization"));
  if (!token) {
    return Response.json({ error: "missing bearer token" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const result = await reportParseRunStatusFromGha({
    jobId,
    bearerToken: token,
    body,
  });
  if (!result.ok) {
    const status = result.reason === "forbidden" ? 403 : 400;
    return Response.json({ error: result.reason }, { status });
  }
  return Response.json({ status: "ok" });
}

export async function handleParseOriginalFile(
  attachmentId: string,
  request: Request,
): Promise<Response> {
  const token = extractBearer(request.headers.get("authorization"));
  if (!token) {
    return Response.json({ error: "missing bearer token" }, { status: 401 });
  }
  const run = await getParseJobRunForAttachmentToken(
    attachmentId,
    hashRunToken(token),
  );
  if (!run) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const parseable = await resolveParseableFile(run);
  if (!parseable || parseable.id !== attachmentId) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const bytes = await getAttachmentBytes(parseable.scopeId, parseable.storageKey);
  if (!bytes?.byteLength) {
    console.error("[parse] original bytes missing", {
      attachmentId,
      chatId: parseable.scopeId,
      storageKey: parseable.storageKey,
      jobId: run.jobId,
    });
    return Response.json({ error: "original not found" }, { status: 404 });
  }
  return new Response(Buffer.from(bytes), {
    headers: { "content-type": parseable.mediaType },
  });
}

export async function handleParseArtifactsBatch(
  attachmentId: string,
  request: Request,
): Promise<Response> {
  try {
    const token = extractBearer(request.headers.get("authorization"));
    if (!token) {
      return Response.json({ error: "missing bearer token" }, { status: 401 });
    }
    const run = await getParseJobRunForAttachmentToken(
      attachmentId,
      hashRunToken(token),
    );
    if (!run) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ error: "invalid multipart body" }, { status: 400 });
    }
    let contentData: Uint8Array;
    let metaData: Uint8Array;
    let pageData: Uint8Array | null;
    try {
      ({ contentData, metaData, pageData } = await readBatchArtifactsFromForm(form));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "content_md and meta_json required";
      return Response.json({ error: message }, { status: 400 });
    }

    const artifacts: Array<{
      artifactKey: string;
      sizeBytes: number;
      contentType: string;
    }> = [
      {
        artifactKey: "content_md",
        sizeBytes: contentData.byteLength,
        contentType: "text/markdown; charset=utf-8",
      },
      {
        artifactKey: "meta_json",
        sizeBytes: metaData.byteLength,
        contentType: "application/json",
      },
    ];

    await saveParsedArtifact(
      run.scopeId,
      attachmentId,
      "content_md",
      contentData,
      "text/markdown; charset=utf-8",
    );
    await saveParsedArtifact(
      run.scopeId,
      attachmentId,
      "meta_json",
      metaData,
      "application/json",
    );

    if (pageData) {
      await saveParsedArtifact(
        run.scopeId,
        attachmentId,
        "pageindex_json",
        pageData,
        "application/json",
      );
      artifacts.push({
        artifactKey: "pageindex_json",
        sizeBytes: pageData.byteLength,
        contentType: "application/json",
      });
    }

    const ok = await recordParsedArtifactsForRun(run, artifacts);
    if (!ok) {
      return Response.json({ error: "file not found" }, { status: 404 });
    }
    return Response.json({
      status: "ok",
      artifacts: artifacts.map((item) => item.artifactKey),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "artifacts batch failed";
    console.error("[parse-internal] artifacts batch failed", {
      attachmentId,
      error: message,
    });
    return Response.json({ error: message }, { status: 500 });
  }
}

export function isFormDataUploadPart(
  value: FormDataEntryValue,
): value is File | Blob {
  if (typeof value !== "object" || value === null) return false;
  if (value instanceof Blob) return true;
  return (
    "arrayBuffer" in value &&
    typeof (value as Blob).arrayBuffer === "function" &&
    "size" in value &&
    typeof (value as Blob).size === "number"
  );
}

export async function readBatchArtifactsFromForm(form: FormData): Promise<{
  contentData: Uint8Array;
  metaData: Uint8Array;
  pageData: Uint8Array | null;
}> {
  const contentMd = form.get("content_md");
  const metaJson = form.get("meta_json");
  const pageindexJson = form.get("pageindex_json");
  if (!isFormDataUploadPart(contentMd) || !isFormDataUploadPart(metaJson)) {
    throw new Error("content_md and meta_json required");
  }
  if (contentMd.size <= 0 || metaJson.size <= 0) {
    throw new Error("content_md and meta_json required");
  }
  const contentData = new Uint8Array(await contentMd.arrayBuffer());
  const metaData = new Uint8Array(await metaJson.arrayBuffer());
  let pageData: Uint8Array | null = null;
  if (isFormDataUploadPart(pageindexJson) && pageindexJson.size > 0) {
    pageData = new Uint8Array(await pageindexJson.arrayBuffer());
  }
  return { contentData, metaData, pageData };
}

export async function readEmailDerivedPartsFromForm(
  form: FormData,
): Promise<Array<{ filename: string; mediaType: string; bytes: Uint8Array }>> {
  const parts: Array<{ filename: string; mediaType: string; bytes: Uint8Array }> =
    [];
  for (const [fieldName, value] of form.entries()) {
    if (!isFormDataUploadPart(value) || value.size <= 0) continue;
    parts.push({
      filename: resolveEmailDerivedPartFilename(fieldName, value),
      mediaType:
        value instanceof File && value.type
          ? value.type
          : "application/octet-stream",
      bytes: new Uint8Array(await value.arrayBuffer()),
    });
  }
  return parts;
}

/** Multipart field name is often "files"; real filename is in Content-Disposition or field key. */
export function resolveEmailDerivedPartFilename(
  fieldName: string,
  file: File | Blob,
): string {
  if (file instanceof File) {
    const fromFile = file.name?.trim();
    if (fromFile && fromFile !== "files" && fromFile !== "file") {
      return fromFile;
    }
  }
  const fromField = fieldName.trim();
  if (fromField && fromField !== "files" && fromField !== "file") {
    return fromField;
  }
  return "attachment.bin";
}

export async function handleParseEmailDerived(
  attachmentId: string,
  request: Request,
): Promise<Response> {
  const token = extractBearer(request.headers.get("authorization"));
  if (!token) {
    return Response.json({ error: "missing bearer token" }, { status: 401 });
  }
  const run = await getParseJobRunForAttachmentToken(
    attachmentId,
    hashRunToken(token),
  );
  if (!run || run.attachmentId !== attachmentId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid multipart body" }, { status: 400 });
  }

  const parts = await readEmailDerivedPartsFromForm(form);

  if (parts.length === 0) {
    return Response.json(
      { error: "no attachment parts in multipart body" },
      { status: 400 },
    );
  }

  try {
    const result = await materializeEmailDerivedAttachments({
      run,
      parentAttachmentId: attachmentId,
      parts,
    });
    return Response.json({ status: "ok", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "email derived failed";
    return Response.json({ error: message }, { status: 400 });
  }
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

function normalizeFigureId(raw: string): string {
  const trimmed = raw.trim();
  const base = trimmed.replace(/^figure:/i, "");
  const slash = base.lastIndexOf("/");
  const segment = slash >= 0 ? base.slice(slash + 1) : base;
  return segment.replace(/\.[^.]+$/, "");
}

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) return "jpeg";
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_TO_EXT[normalized] ?? "jpeg";
}

export async function handleParseFigurePut(
  attachmentId: string,
  figureIdParam: string,
  request: Request,
): Promise<Response> {
  const token = extractBearer(request.headers.get("authorization"));
  if (!token) {
    return Response.json({ error: "missing bearer token" }, { status: 401 });
  }
  const run = await getParseJobRunForAttachmentToken(
    attachmentId,
    hashRunToken(token),
  );
  if (!run) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const figureId = normalizeFigureId(figureIdParam);
  const contentType = request.headers.get("content-type");
  const extension = extensionFromContentType(contentType);
  const data = new Uint8Array(await request.arrayBuffer());
  if (!data.byteLength) {
    return Response.json({ error: "empty body" }, { status: 400 });
  }
  await saveParsedFigure(
    run.scopeId,
    attachmentId,
    figureId,
    extension,
    data,
    contentType ?? "application/octet-stream",
  );
  return Response.json({ status: "ok", figure: figureId, extension });
}

export async function handleParseFigureGet(
  attachmentId: string,
  figureIdParam: string,
  request: Request,
): Promise<Response> {
  const token = extractBearer(request.headers.get("authorization"));
  if (!token) {
    return Response.json({ error: "missing bearer token" }, { status: 401 });
  }
  const run = await getParseJobRunForAttachmentToken(
    attachmentId,
    hashRunToken(token),
  );
  if (!run) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const figureId = normalizeFigureId(figureIdParam);
  for (const extension of ["jpeg", "jpg", "png", "webp", "gif"]) {
    const ext = extension === "jpg" ? "jpeg" : extension;
    const bytes = await loadParsedFigure(run.scopeId, attachmentId, figureId, ext);
    if (bytes?.byteLength) {
      const mime =
        ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : ext === "gif"
              ? "image/gif"
              : "image/jpeg";
      return new Response(Buffer.from(bytes), {
        headers: { "content-type": mime },
      });
    }
  }
  return Response.json({ error: "not found" }, { status: 404 });
}

export async function handleParseWebhook(request: Request): Promise<Response> {
  const webhookId = request.headers.get("x-parse-webhook-id");
  const timestamp = request.headers.get("x-parse-timestamp");
  const signature = request.headers.get("x-parse-signature");
  if (!webhookId || !timestamp) {
    return Response.json({ error: "missing webhook headers" }, { status: 400 });
  }

  const bodyBytes = new Uint8Array(await request.arrayBuffer());
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(new TextDecoder().decode(bodyBytes)) as Record<
      string,
      unknown
    >;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const jobId = String(payload.job_id ?? "");
  if (!jobId) {
    return Response.json({ error: "missing job_id" }, { status: 400 });
  }

  const run = await getParseJobRunByJobId(jobId);
  if (!run) {
    return Response.json({ error: "unknown job" }, { status: 403 });
  }

  if (
    !verifyWebhookSignature({
      secret: run.webhookSecret,
      timestamp,
      body: bodyBytes,
      signatureHeader: signature,
    })
  ) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  await applyParseWebhook({
    jobId,
    webhookSecret: run.webhookSecret,
    payload,
  });
  return Response.json({ status: "ok" });
}
