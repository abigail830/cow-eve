import { createHash } from "node:crypto";
import {
  classifyAttachment,
  isDocumentKind,
} from "../../domain/attachment/attachment-kinds.js";
import {
  gistMetadataToText,
  parseGistMetadata,
} from "../../domain/attachment/gist-schema.js";
import { workspaceLibraryId } from "../../domain/document/document-scope.js";
import { parsedArtifactInManifest } from "../../domain/docstore/parsed-manifest.js";
import { ParseStatus } from "../../domain/parse/parse-status.js";
import {
  getAttachmentGistMaxInputChars,
  getAttachmentGistMaxOutputTokens,
  isAttachmentGistEnabled,
} from "../../infrastructure/config/parse-pipeline.config.js";
import { loadParsedArtifact } from "../../infrastructure/attachment/parsed-artifact-storage.js";
import { drizzleWorkspaceRepository } from "../../infrastructure/persistence/workspace/drizzle-workspace.repository.js";
import { completeUtilityChat } from "../llm/utility-chat-completion.js";
import {
  buildGistUserPrompt,
  GIST_SYSTEM_INSTRUCTIONS,
  sectionTitlesFromMeta,
  truncateMarkdownForGist,
} from "./gist-prompt.js";

function contentSha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function loadMetaJson(
  scopeId: string,
  fileId: string,
): Promise<Record<string, unknown> | null> {
  const raw = await loadParsedArtifact(scopeId, fileId, "meta_json");
  if (!raw?.byteLength) return null;
  try {
    return JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function loadContentMd(scopeId: string, fileId: string): Promise<string> {
  const raw = await loadParsedArtifact(scopeId, fileId, "content_md");
  if (!raw?.byteLength) throw new Error("content_md missing");
  return new TextDecoder("utf-8", { fatal: false }).decode(raw);
}

export async function generateAndSaveWorkspaceFileGist(
  fileId: string,
): Promise<boolean> {
  if (!isAttachmentGistEnabled()) return false;

  const row = await drizzleWorkspaceRepository.getFileByIdOnly(fileId);
  if (!row) return false;
  if (row.parseStatus !== ParseStatus.READY) return false;
  if (!parsedArtifactInManifest(row.parsedArtifactManifest, "content_md")) {
    return false;
  }

  const kind = classifyAttachment({
    filename: row.filename,
    mimeType: row.mediaType,
  });
  if (!isDocumentKind(kind)) return false;

  const scopeId = workspaceLibraryId(row.userId);
  let fullContent: string;
  try {
    fullContent = await loadContentMd(scopeId, row.id);
  } catch {
    return false;
  }

  const contentSha = contentSha256(fullContent);
  if (row.gist && row.gistContentSha256 === contentSha) return true;

  let meta: Record<string, unknown> | null = null;
  if (parsedArtifactInManifest(row.parsedArtifactManifest, "meta_json")) {
    try {
      meta = await loadMetaJson(scopeId, row.id);
    } catch {
      meta = null;
    }
  }

  const truncated = truncateMarkdownForGist(
    fullContent,
    getAttachmentGistMaxInputChars(),
  );
  const userPrompt = buildGistUserPrompt({
    filename: row.filename,
    mimeType: row.mediaType,
    markdown: truncated,
    sectionTitles: sectionTitlesFromMeta(meta),
  });

  let raw = await completeUtilityChat({
    system: GIST_SYSTEM_INSTRUCTIONS,
    user: userPrompt,
    maxTokens: getAttachmentGistMaxOutputTokens(),
    temperature: 0.2,
  });
  let metadata = parseGistMetadata(raw);
  if (!metadata) {
    raw = await completeUtilityChat({
      system: GIST_SYSTEM_INSTRUCTIONS,
      user: `${userPrompt}\n\nYour previous reply was not valid JSON. Reply with JSON only.`,
      maxTokens: getAttachmentGistMaxOutputTokens(),
      temperature: 0.2,
    });
    metadata = parseGistMetadata(raw);
  }
  if (!metadata) return false;

  const gistText = gistMetadataToText(metadata);
  if (!gistText) return false;

  await drizzleWorkspaceRepository.saveGist(fileId, {
    gist: gistText,
    gistContentSha256: contentSha,
  });
  return true;
}
