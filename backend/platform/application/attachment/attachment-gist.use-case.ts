import { createHash } from "node:crypto";
import {
  classifyAttachment,
  isDocumentKind,
} from "../../domain/attachment/attachment-kinds.js";
import {
  gistMetadataToText,
  parseGistMetadata,
} from "../../domain/attachment/gist-schema.js";
import { parsedArtifactInManifest } from "../../domain/docstore/parsed-manifest.js";
import { ParseStatus } from "../../domain/parse/parse-status.js";
import {
  getAttachmentGistMaxInputChars,
  getAttachmentGistMaxOutputTokens,
  isAttachmentGistEnabled,
} from "../../infrastructure/config/parse-pipeline.config.js";
import {
  loadContentMd,
  loadMetaForAttachment,
} from "../doc-retrieval/chat-library.js";
import {
  getDecryptedApiKey,
  loadModelSettings,
} from "../settings/model-settings.use-case.js";
import { drizzleChatAttachmentRepository } from "../../infrastructure/persistence/attachment/drizzle-chat-attachment.repository.js";
import {
  buildGistUserPrompt,
  GIST_SYSTEM_INSTRUCTIONS,
  sectionTitlesFromMeta,
  truncateMarkdownForGist,
} from "./gist-prompt.js";

function contentSha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function completeGist(prompt: string): Promise<string> {
  const settings = await loadModelSettings();
  const apiKey = getDecryptedApiKey(settings);
  if (!apiKey) {
    throw new Error("Model API key is not configured for attachment gist");
  }
  const base = settings.baseURL.replace(/\/+$/, "");
  const url = `${base}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.modelId,
      temperature: 0.2,
      max_tokens: getAttachmentGistMaxOutputTokens(),
      messages: [
        { role: "system", content: GIST_SYSTEM_INSTRUCTIONS },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gist LLM failed (${response.status}): ${text.slice(0, 500)}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return String(data.choices?.[0]?.message?.content ?? "").trim();
}

export async function generateAndSaveAttachmentGist(
  attachmentId: string,
): Promise<boolean> {
  if (!isAttachmentGistEnabled()) return false;

  const row = await drizzleChatAttachmentRepository.getByIdOnly(attachmentId);
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

  let fullContent: string;
  try {
    fullContent = await loadContentMd(row.chatId, row.id);
  } catch {
    return false;
  }

  const contentSha = contentSha256(fullContent);
  if (row.gist && row.gistContentSha256 === contentSha) return true;

  let meta: Record<string, unknown> | null = null;
  if (parsedArtifactInManifest(row.parsedArtifactManifest, "meta_json")) {
    try {
      meta = await loadMetaForAttachment(row.chatId, row.id);
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

  let raw = await completeGist(userPrompt);
  let metadata = parseGistMetadata(raw);
  if (!metadata) {
    raw = await completeGist(
      `${userPrompt}\n\nYour previous reply was not valid JSON. Reply with JSON only.`,
    );
    metadata = parseGistMetadata(raw);
  }
  if (!metadata) return false;

  const gistText = gistMetadataToText(metadata);
  if (!gistText) return false;

  await drizzleChatAttachmentRepository.saveGist(attachmentId, {
    gist: gistText,
    gistContentSha256: contentSha,
  });
  return true;
}
