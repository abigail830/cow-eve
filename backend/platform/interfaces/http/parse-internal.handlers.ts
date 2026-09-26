import {
  applyParseWebhook,
  getParseJobPayloadForRun,
  verifyWebhookSignature,
} from "../../application/parse/parse-webhook.use-case.js";
import { getAttachmentBytes } from "../../infrastructure/attachment/attachment-storage.js";
import {
  loadParsedFigure,
  saveParsedArtifact,
  saveParsedFigure,
} from "../../infrastructure/attachment/parsed-artifact-storage.js";
import { hashRunToken } from "../../infrastructure/parse-pipeline/job-builder.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import {
  getParseJobRunForAttachmentToken,
  getParseJobRunByJobId,
} from "../../infrastructure/persistence/parse/drizzle-parse-job.repository.js";

function extractBearer(authorization: string | null): string | null {
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  return authorization.split(" ", 2)[1]?.trim() ?? null;
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
  const attachment = await drizzleChatAttachmentRepository.getById({
    chatId: run.chatId,
    attachmentId,
  });
  if (!attachment) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const bytes = await getAttachmentBytes(run.chatId, attachment.storageKey);
  if (!bytes?.byteLength) {
    return Response.json({ error: "original not found" }, { status: 404 });
  }
  return new Response(Buffer.from(bytes), {
    headers: { "content-type": attachment.mediaType },
  });
}

export async function handleParseArtifactsBatch(
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid multipart body" }, { status: 400 });
  }
  const contentMd = form.get("content_md");
  const metaJson = form.get("meta_json");
  const pageindexJson = form.get("pageindex_json");
  if (!(contentMd instanceof File) || !(metaJson instanceof File)) {
    return Response.json({ error: "content_md and meta_json required" }, { status: 400 });
  }

  const contentData = new Uint8Array(await contentMd.arrayBuffer());
  const metaData = new Uint8Array(await metaJson.arrayBuffer());
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
    run.chatId,
    attachmentId,
    "content_md",
    contentData,
    "text/markdown; charset=utf-8",
  );
  await saveParsedArtifact(
    run.chatId,
    attachmentId,
    "meta_json",
    metaData,
    "application/json",
  );

  if (pageindexJson instanceof File && pageindexJson.size > 0) {
    const pageData = new Uint8Array(await pageindexJson.arrayBuffer());
    await saveParsedArtifact(
      run.chatId,
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

  const updated = await drizzleChatAttachmentRepository.recordParsedArtifactsBatch(
    attachmentId,
    { chatId: run.chatId, artifacts },
  );
  if (!updated) {
    return Response.json({ error: "attachment not found" }, { status: 404 });
  }
  return Response.json({
    status: "ok",
    artifacts: artifacts.map((item) => item.artifactKey),
  });
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
    run.chatId,
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
    const bytes = await loadParsedFigure(run.chatId, attachmentId, figureId, ext);
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
