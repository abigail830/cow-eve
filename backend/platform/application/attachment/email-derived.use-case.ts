import { createHash } from "node:crypto";
import {
  classifyAttachment,
  type AttachmentKind,
} from "../../domain/attachment/attachment-kinds.js";
import {
  finalizeAttachmentParse,
  finalizeWorkspaceFileParse,
  sha256Bytes,
} from "./parse-enqueue.use-case.js";
import { putAttachmentBytes } from "../../infrastructure/attachment/attachment-storage.js";
import {
  loadParsedArtifact,
  saveParsedArtifact,
} from "../../infrastructure/attachment/parsed-artifact-storage.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import { drizzleWorkspaceRepository } from "../../infrastructure/persistence/workspace/drizzle-workspace.repository.js";
import type { ParseJobRun } from "../../infrastructure/persistence/parse/drizzle-parse-job.repository.js";

type DerivedPartRecord = {
  part_hash: string;
  attachment_id: string;
  filename: string;
};

type SkippedPartRecord = {
  filename: string;
  reason: string;
};

function pipelineIdFromRun(run: ParseJobRun): string | null {
  const payload = run.jobPayloadJson;
  const pipeline = payload.pipeline_id ?? payload.pipelineId;
  return typeof pipeline === "string" ? pipeline : null;
}

function storageKeyFor(id: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-()+ ]+/g, "_") || "file";
  return `${id}/${safe}`;
}

function uniqueFilename(existing: Set<string>, filename: string): string {
  const base = filename.trim() || "attachment.bin";
  if (!existing.has(base.toLowerCase())) {
    existing.add(base.toLowerCase());
    return base;
  }
  const dot = base.lastIndexOf(".");
  const stem = dot >= 0 ? base.slice(0, dot) : base;
  const ext = dot >= 0 ? base.slice(dot) : "";
  let n = 2;
  while (n < 100) {
    const candidate = `${stem} (${n})${ext}`;
    if (!existing.has(candidate.toLowerCase())) {
      existing.add(candidate.toLowerCase());
      return candidate;
    }
    n += 1;
  }
  const fallback = `${stem}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  existing.add(fallback.toLowerCase());
  return fallback;
}

async function loadParentEmailMeta(
  scopeId: string,
  parentId: string,
): Promise<Record<string, unknown>> {
  const raw = await loadParsedArtifact(scopeId, parentId, "meta_json");
  if (!raw?.byteLength) return {};
  try {
    return JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function saveParentEmailMeta(
  scopeId: string,
  parentId: string,
  meta: Record<string, unknown>,
): Promise<void> {
  const bytes = new TextEncoder().encode(JSON.stringify(meta, null, 2));
  await saveParsedArtifact(
    scopeId,
    parentId,
    "meta_json",
    bytes,
    "application/json",
  );
}

function partHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** True when parent email meta lists attachments but platform never materialized them. */
export async function emailDerivedMaterializationIncomplete(
  scopeId: string,
  parentAttachmentId: string,
): Promise<boolean> {
  const meta = await loadParentEmailMeta(scopeId, parentAttachmentId);
  if (meta.kind !== "email") return false;
  const attachmentCount =
    typeof meta.attachment_count === "number" ? meta.attachment_count : 0;
  if (attachmentCount <= 0) return false;
  const derived = Array.isArray(meta.derived_parts) ? meta.derived_parts : [];
  const skipped = Array.isArray(meta.skipped_parts) ? meta.skipped_parts : [];
  return derived.length + skipped.length < attachmentCount;
}

export async function materializeEmailDerivedAttachments(input: {
  run: ParseJobRun;
  parentAttachmentId: string;
  parts: ReadonlyArray<{
    filename: string;
    mediaType: string;
    bytes: Uint8Array;
  }>;
}): Promise<{ created: number; skipped: number; materialized: number }> {
  if (input.run.attachmentId !== input.parentAttachmentId) {
    throw new Error("Parent attachment id mismatch.");
  }
  const pipelineId = pipelineIdFromRun(input.run);
  if (pipelineId !== "email_standard") {
    throw new Error(`Expected email_standard pipeline, got ${pipelineId ?? "unknown"}.`);
  }

  const scopeId = input.run.scopeId;
  const meta = await loadParentEmailMeta(scopeId, input.parentAttachmentId);
  const derivedParts = Array.isArray(meta.derived_parts)
    ? (meta.derived_parts as DerivedPartRecord[])
    : [];
  const skippedParts = Array.isArray(meta.skipped_parts)
    ? (meta.skipped_parts as SkippedPartRecord[])
    : [];
  const derivedIds = Array.isArray(meta.derived_attachment_ids)
    ? (meta.derived_attachment_ids as string[])
    : [];

  const namesInScope = new Set<string>();
  if (input.run.sourceKind === "chat_attachment") {
    const rows = await drizzleChatAttachmentRepository.listByChatId(scopeId);
    for (const row of rows) namesInScope.add(row.filename.toLowerCase());
  } else {
    const parent = await drizzleWorkspaceRepository.getFileByIdOnly(
      input.parentAttachmentId,
    );
    if (parent) {
      const siblings = await drizzleWorkspaceRepository.listFilesInFolder({
        userId: parent.userId,
        folderId: parent.folderId,
      });
      for (const row of siblings) namesInScope.add(row.filename.toLowerCase());
    }
  }

  let created = 0;
  let skipped = 0;

  for (const part of input.parts) {
    const hash = partHash(part.bytes);
    const existing = derivedParts.find((row) => row.part_hash === hash);
    if (existing) {
      skipped += 1;
      continue;
    }

    let kind: AttachmentKind;
    try {
      kind = classifyAttachment({
        filename: part.filename,
        mimeType: part.mediaType,
      });
    } catch {
      skippedParts.push({
        filename: part.filename,
        reason: "unsupported_type",
      });
      skipped += 1;
      continue;
    }

    const filename = uniqueFilename(namesInScope, part.filename);
    const childId = crypto.randomUUID();
    const storageKey = storageKeyFor(childId, filename);
    const contentHash = sha256Bytes(part.bytes);

    await putAttachmentBytes(scopeId, storageKey, part.bytes, part.mediaType);

    if (input.run.sourceKind === "chat_attachment") {
      const saved = await drizzleChatAttachmentRepository.createWithId({
        id: childId,
        chatId: scopeId,
        filename,
        mediaType: part.mediaType,
        sizeBytes: part.bytes.byteLength,
        storageKey,
        contentHash,
      });
      await finalizeAttachmentParse(saved, kind);
    } else {
      const parent = await drizzleWorkspaceRepository.getFileByIdOnly(
        input.parentAttachmentId,
      );
      if (!parent) {
        throw new Error("Parent workspace file not found.");
      }
      const row = await drizzleWorkspaceRepository.createFile({
        id: childId,
        userId: parent.userId,
        folderId: parent.folderId,
        filename,
        mediaType: part.mediaType,
        sizeBytes: part.bytes.byteLength,
        storageKey,
        contentHash,
      });
      await finalizeWorkspaceFileParse(row, kind);
    }

    derivedParts.push({
      part_hash: hash,
      attachment_id: childId,
      filename,
    });
    if (!derivedIds.includes(childId)) derivedIds.push(childId);
    created += 1;
  }

  meta.derived_parts = derivedParts;
  meta.skipped_parts = skippedParts;
  meta.derived_attachment_ids = derivedIds;
  await saveParentEmailMeta(scopeId, input.parentAttachmentId, meta);

  return {
    created,
    skipped,
    materialized: created,
  };
}
